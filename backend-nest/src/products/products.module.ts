// backend-nest/src/products/products.module.ts

import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { TypeOrmModule } from '@nestjs/typeorm'; // Eklendi
import { Product } from './entities/product.entity'; // Eklendi

@Module({
  imports: [TypeOrmModule.forFeature([Product])], // Entity'yi modüle kaydettik
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}