-- AlterTable
ALTER TABLE "User" ADD COLUMN     "connectCode" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_connectCode_key" ON "User"("connectCode");

