import { PrismaClient } from "@prisma/client";
import { serverEnvironment } from "./env.server";

void serverEnvironment.DATABASE_URL;

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;
