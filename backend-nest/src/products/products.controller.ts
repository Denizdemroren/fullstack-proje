import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpStatus, Res, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { ProductsService } from './products.service';

// Tip tanımları (Frontend'den gelen verinin yapısı)
interface ProductDto {
  name: string;
  price: number;
}

@Controller('products')
@UseGuards(AuthGuard('jwt')) // Tüm uç noktalar JWT ile korunur
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(@Request() req: any): Promise<any> {
    // Sadece mevcut kullanıcının ürünlerini getir
    return this.productsService.findByUserId(req.user.userId);
  }

  @Post()
  async create(@Body() productDto: ProductDto, @Request() req: any): Promise<any> {
    // Mevcut kullanıcının ID'si ile ürün oluştur
    return this.productsService.create(productDto, req.user.userId);
  }

  // YENİ METOT: Ürün Güncelleme (PUT /products/:id)
  @Put(':id')
  async update(@Param('id') id: string, @Body() productDto: ProductDto, @Res() res: Response): Promise<any> {
    // ID bir sayıya dönüştürülür
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
        return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Geçersiz ürün ID formatı.' });
    }
    
    try {
        const updatedProduct = await this.productsService.update(productId, productDto);
        if (!updatedProduct) {
            // Ürün bulunamazsa 404 döndür
            return res.status(HttpStatus.NOT_FOUND).json({ message: 'Ürün bulunamadı.' });
        }
        // Başarılı güncelleme için 200 OK döndür
        return res.status(HttpStatus.OK).json(updatedProduct);
    } catch (error) {
        // Genel sunucu hatası
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Güncelleme sırasında bir hata oluştu.', error: error.message });
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Res() res: Response, @Request() req: any): Promise<any> {
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
        return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Geçersiz ürün ID formatı.' });
    }

    // Ürünü bul ve sahipliğini kontrol et
    const product = await this.productsService.findOne(productId);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'Ürün bulunamadı.' });
    }

    // Ürünü sil
    await this.productsService.remove(productId);
    // Başarılı silme için 204 No Content döndür
    return res.status(HttpStatus.NO_CONTENT).send();
  }
}