import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI!;

let isConnected = false;

export async function connectToDB() {
  if (isConnected) return;
  await mongoose.connect(uri);
  isConnected = true;
}
