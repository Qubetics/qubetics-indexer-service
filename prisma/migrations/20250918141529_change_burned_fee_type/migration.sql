/*
  Warnings:

  - The `burnedFee` column on the `Transactions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Transactions" DROP COLUMN "burnedFee",
ADD COLUMN     "burnedFee" BIGINT NOT NULL DEFAULT 0;
