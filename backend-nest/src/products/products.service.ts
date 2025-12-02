import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  // Tüm ürünleri getir
  async findAll(): Promise<Product[]> {
    return this.productsRepository.find();
  }

  // ID'ye göre ürün bul
  async findOne(id: number): Promise<Product | null> {
    return this.productsRepository.findOneBy({ id });
  }

  // Kullanıcıya ait tüm ürünleri getir
  async findByUserId(userId: number): Promise<Product[]> {
    return this.productsRepository.find({ where: { userId } });
  }

  // Yeni ürün oluştur
  async create(createProductDto: CreateProductDto, userId: number): Promise<Product> {
    const product = this.productsRepository.create({
      ...createProductDto,
      userId,
    });
    return this.productsRepository.save(product);
  }

  // Ürünü güncelle
  async update(id: number, updateProductDto: UpdateProductDto): Promise<Product | null> {
    await this.productsRepository.update(id, updateProductDto);
    return this.findOne(id);
  }

  // Ürünü sil
  async remove(id: number): Promise<void> {
    await this.productsRepository.delete(id);
  }
}