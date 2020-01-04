import firebase from "firebase";
const env = {
  apiKey: `AIzaSyDHArwq-VPRLaSkhyhyJ6ybs_jRvvoQxMU`,
  authDomain: `firecms-92a11.firebaseapp.com`,
  databaseURL: `https://firecms-92a11.firebaseio.com`,
  projectId: `firecms-92a11`,
  storageBucket: `firecms-92a11.appspot.com`,
  messagingSenderId: `283434729273`,
  appId: `1:283434729273:web:64683373db0efede93b2e8`
};

// Initialize Firebase
// @ts-ignore
if (!firebase.apps.default) {
  firebase.initializeApp(env);
}

export default firebase;
