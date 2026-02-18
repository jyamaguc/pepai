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
      
      // Also check if pepPoints are defined in the product metadata for subscription products (rare but possible)
      const pepPointsStr = productData.metadata?.pepPoints || productData.stripe_metadata_pepPoints || "0";
      const pepPoints = parseInt(pepPointsStr);

      const canSave = productData.metadata?.can_save === "true" || productData.stripe_metadata_can_save === "true";
      const canExport = productData.metadata?.can_export === "true" || productData.stripe_metadata_can_export === "true";
      const tier = productData.metadata?.tier || productData.stripe_metadata_tier || "free";

      console.log(`Metadata found: credits=${credits}, pepPoints=${pepPoints}, tier=${tier}`);

      if (credits === 0 && pepPoints === 0) {
        console.log("No credits or pepPoints defined for this product. Skipping.");
        return null;
      }

      // Update user document
      console.log(`Granting ${credits} credits and ${pepPoints} pepPoints to user ${uid}`);
      
      const updateData = {
        credits: credits,
        can_save: canSave,
        can_export: canExport,
        tier: tier,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };

      if (pepPoints > 0) {
        updateData.pepPoints = admin.firestore.FieldValue.increment(pepPoints);
      }

      await db.collection("users").doc(uid).set(updateData, { merge: true });

      return { success: true };
    } catch (error) {
      console.error("Error granting credits:", error);
      return null;
    }
});

/**
 * Triggered when a payment is successful.
 * Handles both monthly credit refills and one-time Pep Points purchases.
 */
exports.handlePaymentSuccess = onDocumentCreated("customers/{uid}/payments/{payId}", async (event) => {
    const { uid, payId } = event.params;
    const payment = event.data.data();

    if (!payment || payment.status !== "succeeded") {
      console.log(`Payment ${payId} status is ${payment?.status}. Skipping.`);
      return null;
    }

    console.log(`Successful payment detected for user ${uid}. Data:`, JSON.stringify(payment));

    try {
      // 1. Check if this is a one-time purchase for Pep Points
      let productId = payment.product;
      if (!productId && payment.items && payment.items[0]) {
        productId = payment.items[0].price?.product;
      }
      
      // Also check for price.product if items[0].price is an object
      if (!productId && payment.items && payment.items[0] && typeof payment.items[0].price === 'object') {
        productId = payment.items[0].price.product;
      }

      // If we still don't have a productId, but we have a priceId, look it up
      let priceId = payment.price;
      if (!priceId && payment.items && payment.items[0]) {
        priceId = typeof payment.items[0].price === 'string' ? payment.items[0].price : payment.items[0].price?.id;
      }

      console.log(`Extracted productId: ${productId}, priceId: ${priceId}`);

      // Check metadata on the payment itself first (passed during checkout)
      const pepPointsFromMetadata = payment.metadata?.pepPoints || payment.stripe_metadata_pepPoints;
      if (pepPointsFromMetadata) {
        const pointsToAdd = parseInt(pepPointsFromMetadata);
        if (pointsToAdd > 0) {
          await db.collection("users").doc(uid).update({
            pepPoints: admin.firestore.FieldValue.increment(pointsToAdd),
            lastPointsPurchase: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`Added ${pointsToAdd} Pep Points to user ${uid} from payment metadata`);
          return { success: true, type: "pepPoints" };
        }
      }

      const creditsFromMetadata = payment.metadata?.credits || payment.stripe_metadata_credits;
      if (creditsFromMetadata) {
        const creditsToSet = parseInt(creditsFromMetadata);
        if (creditsToSet > 0) {
          await db.collection("users").doc(uid).update({
            credits: creditsToSet,
            lastRefill: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`Refilled ${creditsToSet} credits for user ${uid} from payment metadata`);
          return { success: true, type: "credits" };
        }
      }

      // If no metadata on payment, try to look up product metadata
      if (productId) {
        const productDoc = await db.collection("products").doc(productId).get();
        if (productDoc.exists) {
          const productData = productDoc.data();
          const pepPointsStr = productData.metadata?.pepPoints || productData.stripe_metadata_pepPoints;
          
          if (pepPointsStr) {
            const pointsToAdd = parseInt(pepPointsStr);
            if (pointsToAdd > 0) {
              await db.collection("users").doc(uid).update({
                pepPoints: admin.firestore.FieldValue.increment(pointsToAdd),
                lastPointsPurchase: admin.firestore.FieldValue.serverTimestamp()
              });
              console.log(`Added ${pointsToAdd} Pep Points to user ${uid} from product metadata`);
              return { success: true, type: "pepPoints" };
            }
          }
        }
      }

      // 2. If not a one-time Pep Points purchase, check if it's a subscription renewal
      const subsSnap = await db.collection("customers").doc(uid).collection("subscriptions")
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (subsSnap.empty) {
        console.log(`No active subscription found for user ${uid} during payment processing.`);
        return null;
      }

      const subData = subsSnap.docs[0].data();
      let subProductId = null;
      
      if (subData.product) {
        subProductId = typeof subData.product === 'string' ? subData.product : subData.product.id;
      } else if (subData.items && subData.items[0] && subData.items[0].price && subData.items[0].price.product) {
        subProductId = typeof subData.items[0].price.product === 'string' ? subData.items[0].price.product : subData.items[0].price.product.id;
      }

      if (!subProductId) {
        console.error("Could not find productId in subscription data.");
        return null;
      }

      const productDoc = await db.collection("products").doc(subProductId).get();
      if (!productDoc.exists) {
        console.error(`Product doc ${subProductId} not found.`);
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
        return { success: true, type: "credits" };
      }
    } catch (error) {
      console.error("Error during payment processing:", error);
    }
    return null;
});
