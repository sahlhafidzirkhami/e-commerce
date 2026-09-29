-- DropIndex
DROP INDEX "ProductVariant_productId_size_color_key";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "heightCm" INTEGER,
ADD COLUMN     "lengthCm" INTEGER,
ADD COLUMN     "motif" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "shopeeItemId" TEXT,
ADD COLUMN     "sizeChartUrl" TEXT,
ADD COLUMN     "sku" TEXT NOT NULL,
ADD COLUMN     "sleeveLength" TEXT,
ADD COLUMN     "sportType" TEXT,
ADD COLUMN     "widthCm" INTEGER;

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "color";

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopeeItemId_key" ON "Product"("shopeeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_size_key" ON "ProductVariant"("productId", "size");
