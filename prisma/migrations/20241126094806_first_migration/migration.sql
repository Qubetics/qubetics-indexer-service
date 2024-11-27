/*
  Warnings:

  - The `constructorArguements` column on the `ContractVerification` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "ContractVerification" ADD COLUMN     "abis" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "iconUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "implementation" TEXT NOT NULL DEFAULT '',
DROP COLUMN "constructorArguements",
ADD COLUMN     "constructorArguements" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Contracts" ADD COLUMN     "bytecodeHash" VARCHAR(255) NOT NULL DEFAULT '';

-- AddForeignKey
ALTER TABLE "Contracts" ADD CONSTRAINT "Contracts_address_fkey" FOREIGN KEY ("address") REFERENCES "ContractVerification"("contractAddress") ON DELETE RESTRICT ON UPDATE CASCADE;
