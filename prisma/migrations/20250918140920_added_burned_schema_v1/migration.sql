-- AlterTable
ALTER TABLE "Transactions" ADD COLUMN     "burnedFee" VARCHAR(255) NOT NULL DEFAULT '0';

-- CreateTable
CREATE TABLE "internal_transaction" (
    "id" TEXT NOT NULL,
    "txnHash" TEXT NOT NULL,
    "fromAddress" VARCHAR(42) NOT NULL,
    "toAddress" VARCHAR(42) NOT NULL,
    "value" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "callType" TEXT,
    "depth" INTEGER,
    "method" TEXT,
    "input" TEXT,
    "gas" BIGINT NOT NULL,
    "gasUsed" BIGINT NOT NULL,
    "output" TEXT,
    "contractAddress" TEXT,
    "timestamp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internal_transaction_txnHash_idx" ON "internal_transaction"("txnHash");

-- CreateIndex
CREATE INDEX "internal_transaction_blockNumber_idx" ON "internal_transaction"("blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "internal_transaction_txnHash_toAddress_key" ON "internal_transaction"("txnHash", "toAddress");

-- AddForeignKey
ALTER TABLE "internal_transaction" ADD CONSTRAINT "internal_transaction_blockNumber_fkey" FOREIGN KEY ("blockNumber") REFERENCES "Blocks"("blocknumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_transaction" ADD CONSTRAINT "internal_transaction_txnHash_fkey" FOREIGN KEY ("txnHash") REFERENCES "Transactions"("txhash") ON DELETE RESTRICT ON UPDATE CASCADE;
