-- AddForeignKey
ALTER TABLE "Holders" ADD CONSTRAINT "Holders_contractAddress_fkey" FOREIGN KEY ("contractAddress") REFERENCES "Contracts"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractLogs" ADD CONSTRAINT "ContractLogs_contractAddress_fkey" FOREIGN KEY ("contractAddress") REFERENCES "Contracts"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
