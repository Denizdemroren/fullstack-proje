// backend-nest/src/products/dto/create-product.dto.ts

import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer'; // Bu satırı yeniden kullanıyoruz

export class CreateProductDto {
  
  // Ürün Adı
  @IsNotEmpty()
  @IsString()
  name: string;

  // Ürün Fiyatı: Şimdi ondalıklı sayıları da kabul ediyoruz.
  @Type(() => Number) // Gelen string veriyi Number tipine dönüştürmeyi dene
  @IsNumber()       // Sayı olduğunu doğrula (ondalıklı olabilir)
  price: number;
}