-- CreateTable
CREATE TABLE "Docs" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,

    CONSTRAINT "Docs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assistant" (
    "id" SERIAL NOT NULL,
    "aId" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "Assistant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Docs_url_key" ON "Docs"("url");

-- CreateIndex
CREATE INDEX "Docs_identifier_idx" ON "Docs"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Assistant_url_key" ON "Assistant"("url");

