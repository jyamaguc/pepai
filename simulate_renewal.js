const admin = require('firebase-admin');

// Initialize with the project ID
admin.initializeApp({
  projectId: 'gen-lang-client-0420071219'
});

const db = admin.firestore();

async function run() {
  const uid = 'q9JQhrnvy0eFBivHcL4vx5hSCFo2';
  const payId = 'test_renewal_' + Date.now();

  console.log(`Checking user ${uid} before...`);
  const userBefore = await db.collection('users').doc(uid).get();
  console.log('Current credits:', userBefore.data()?.credits);

  console.log(`Creating mock payment: customers/${uid}/payments/${payId}`);
  await db.collection('customers').doc(uid).collection('payments').doc(payId).set({
    status: 'succeeded',
    amount: 2000,
    currency: 'usd',
    created: admin.firestore.Timestamp.now()
  });

  console.log('Payment document created. Waiting 10 seconds for function to trigger...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('Checking user after...');
  const userAfter = await db.collection('users').doc(uid).get();
  console.log('New credits:', userAfter.data()?.credits);
  console.log('Last refill:', userAfter.data()?.lastRefill?.toDate());
}

run().catch(console.error);
