-- CreateTable
CREATE TABLE "activation_code_history" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activation_code_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activation_code_history_code_key" ON "activation_code_history"("code");

-- AddForeignKey
ALTER TABLE "activation_code_history" ADD CONSTRAINT "activation_code_history_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "terminals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
