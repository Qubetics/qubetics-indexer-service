-- DropForeignKey
ALTER TABLE "ContractLogs" DROP CONSTRAINT "ContractLogs_contractAddress_fkey";

-- DropForeignKey
ALTER TABLE "Contracts" DROP CONSTRAINT "Contracts_address_fkey";

-- DropForeignKey
ALTER TABLE "Holders" DROP CONSTRAINT "Holders_contractAddress_fkey";

-- AddForeignKey
ALTER TABLE "ContractVerification" ADD CONSTRAINT "ContractVerification_contractAddress_fkey" FOREIGN KEY ("contractAddress") REFERENCES "Contracts"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
