// Access the firebase instance loaded via CDN in index.html
const firebase = (window as any).firebase;

if (!firebase) {
    console.error("Firebase SDK not found in window object. Ensure Firebase scripts are loaded in index.html");
}

const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

export { firebase, db, auth, storage };