import * as fs from "node:fs";
import * as path from "node:path";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

const firebaseConfig = {
  apiKey: "AIzaSyBmsQAaUjtOGhQL11V4fPkjH-tusg3rH9o",
  authDomain: "epath-f6277.firebaseapp.com",
  projectId: "epath-f6277",
  storageBucket: "epath-f6277.firebasestorage.app",
  messagingSenderId: "845423652952",
  appId: "1:845423652952:web:e9bd405a933f54d590da2d",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function seedUsers() {
  const users = [
    {
      email: "admin@epath.com",
      password: "Admin123!",
      displayName: "Admin User",
      role: "admin",
    },
    {
      email: "hr@epath.com",
      password: "Hr123!",
      displayName: "HR Manager",
      role: "hr",
    },
    {
      email: "trainer@epath.com",
      password: "Trainer123!",
      displayName: "Trainer User",
      role: "trainer",
    },
    {
      email: "employee@epath.com",
      password: "Employee123!",
      displayName: "Employee User",
      role: "employee",
    },
  ];

  console.log("Creating test users...\n");

  for (const user of users) {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        user.email,
        user.password
      );
      
      await updateProfile(userCredential.user, {
        displayName: user.displayName,
      });

      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        photoURL: null,
        enrolledCourses: [],
        completedCourses: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      console.log(`✓ Created ${user.role}: ${user.email}`);
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        console.log(`○ Already exists: ${user.email} (${user.role})`);
      } else {
        console.error(`✗ Error creating ${user.email}:`, error.message);
      }
    }
  }

  console.log("\nDone!");
  process.exit(0);
}

seedUsers();
