const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

/**
 * Triggered when a new subscription is created or updated by the Stripe extension.
 * Grants credits to the user based on the product metadata.
 */
exports.handleSubscriptionChange = onDocumentWritten("customers/{uid}/subscriptions/{subId}", async (event) => {
    const { uid, subId } = event.params;
    
    if (!event.data || !event.data.after) {
      console.log("No data after write. Skipping.");
      return null;
    }

    const data = event.data.after.data();
    console.log(`Subscription change for user ${uid}, sub ${subId}. Status: ${data?.status}`);

    // Only proceed if subscription is active or trialing
    if (!data || !["active", "trialing"].includes(data.status)) {
      console.log(`Subscription ${subId} is not active (${data?.status}). Skipping credit grant.`);
      return null;
    }

    // Attempt to find productId
    let productId = null;
    
    // 1. Check top-level product field (sometimes a reference or string)
    if (data.product) {
      productId = typeof data.product === 'string' ? data.product : data.product.id;
    }
    
    // 2. Check items array (standard Stripe structure)
    if (!productId && data.items && data.items[0]) {
      const item = data.items[0];
      if (item.price && item.price.product) {
        productId = typeof item.price.product === 'string' ? item.price.product : item.price.product.id;
      }
    }

    if (!productId) {
      console.error("Could not find productId in subscription data. Keys:", Object.keys(data));
      return null;
    }

    console.log(`Processing subscription for user ${uid}, product ${productId}`);

    try {
      // Fetch product metadata
      const productDoc = await db.collection("products").doc(productId).get();
      let productData = null;
      
      if (productDoc.exists) {
        productData = productDoc.data();
      } else {
        console.log(`Product doc ${productId} not found. Searching products collection...`);
        const productQuery = await db.collection("products").where("id", "==", productId).limit(1).get();
        if (!productQuery.empty) {
          productData = productQuery.docs[0].data();
        }
      }

      if (!productData) {
        console.error(`Product data for ${productId} not found.`);
        return null;
      }

      // Check both metadata and stripe_metadata prefixes (extension varies)
      const creditsStr = productData.metadata?.credits || productData.stripe_metadata_credits || "0";
      const credits = parseInt(creditsStr);
      
      const canSave = productData.metadata?.can_save === "true" || productData.stripe_metadata_can_save === "true";
      const canExport = productData.metadata?.can_export === "true" || productData.stripe_metadata_can_export === "true";
      const tier = productData.metadata?.tier || productData.stripe_metadata_tier || "free";

      console.log(`Metadata found: credits=${credits}, tier=${tier}`);

      if (credits === 0) {
        console.log("No credits defined for this product. Skipping.");
        return null;
      }

      // Update user document
      console.log(`Granting ${credits} credits to user ${uid}`);
      
      await db.collection("users").doc(uid).set({
        credits: credits,
        can_save: canSave,
        can_export: canExport,
        tier: tier,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return { success: true };
    } catch (error) {
      console.error("Error granting credits:", error);
      return null;
    }
});

/**
 * Triggered when a payment is successful (monthly renewal).
 * Refills credits for the new billing month.
 */
exports.handleMonthlyRenewal = onDocumentCreated("customers/{uid}/payments/{payId}", async (event) => {
    const { uid, payId } = event.params;
    const payment = event.data.data();

    if (!payment || payment.status !== "succeeded") {
      console.log(`Payment ${payId} status is ${payment?.status}. Skipping refill.`);
      return null;
    }

    console.log(`Successful payment detected for user ${uid}. Refilling credits...`);

    try {
      // Find the user's active subscription
      const subsSnap = await db.collection("customers").doc(uid).collection("subscriptions")
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (subsSnap.empty) {
        console.log(`No active subscription found for user ${uid} during refill.`);
        return null;
      }

      const subData = subsSnap.docs[0].data();
      let productId = null;
      
      if (subData.product) {
        productId = typeof subData.product === 'string' ? subData.product : subData.product.id;
      } else if (subData.items && subData.items[0] && subData.items[0].price && subData.items[0].price.product) {
        productId = typeof subData.items[0].price.product === 'string' ? subData.items[0].price.product : subData.items[0].price.product.id;
      }

      if (!productId) {
        console.error("Could not find productId in subscription data for refill.");
        return null;
      }

      const productDoc = await db.collection("products").doc(productId).get();
      if (!productDoc.exists) {
        console.error(`Product doc ${productId} not found during refill.`);
        return null;
      }

      const productData = productDoc.data();
      const creditsStr = productData.metadata?.credits || productData.stripe_metadata_credits || "0";
      const credits = parseInt(creditsStr);

      if (credits > 0) {
        await db.collection("users").doc(uid).update({
          credits: credits,
          lastRefill: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Refilled ${credits} credits for user ${uid}`);
      }
    } catch (error) {
      console.error("Error during monthly refill:", error);
    }
    return null;
});
