-- CreateTable
CREATE TABLE "Docs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "identifier" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Assistant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "aId" TEXT NOT NULL,
    "url" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Docs_url_key" ON "Docs"("url");

-- CreateIndex
CREATE INDEX "Docs_identifier_idx" ON "Docs"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Assistant_url_key" ON "Assistant"("url");
