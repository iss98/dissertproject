import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDyJqGDrxasaHgFXVg6CULVoggszO5KFVs",
  authDomain: "snuaied-1113.firebaseapp.com",
  projectId: "snuaied-1113",
  storageBucket: "snuaied-1113.firebasestorage.app",
  messagingSenderId: "113291431365",
  appId: "1:113291431365:web:1c3868c2ec261fb3b24fac",
  measurementId: "G-QMG7N15DSH"
};

const app = initializeApp(firebaseConfig);

// ⭐⭐⭐ 이게 반드시 있어야 함
export const db = getFirestore(app);