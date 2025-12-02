import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';

// Repository'yi simüle etmek için mock objesi oluşturuyoruz.
const mockProductRepository = {
  // .create() metodunu simüle ediyoruz
  create: jest.fn(product => product),
  // .save() metodunu simüle ediyoruz (ürün ekleme/güncelleme)
  save: jest.fn(product => Promise.resolve({ id: 1, ...product })), 
  // .find() metodunu simüle ediyoruz (ürün listeleme)
  find: jest.fn((options?: any) => {
    if (options?.where?.userId === 1) {
      return Promise.resolve([{ id: 1, name: 'Test Ürün', price: 100, userId: 1 }]);
    }
    return Promise.resolve([{ id: 1, name: 'Test Ürün', price: 100 }]);
  }),
  // .delete() metodunu simüle ediyoruz
  delete: jest.fn((id) => Promise.resolve({ affected: 1 })),
  // .findOneBy() metodunu simüle ediyoruz (ürün bulma)
  findOneBy: jest.fn((options) => {
    if (options.id === 1) {
        return Promise.resolve({ id: 1, name: 'Test Ürün', price: 100 });
    }
    return Promise.resolve(null);
  }),
  // .update() metodunu simüle ediyoruz
  update: jest.fn(() => Promise.resolve({ affected: 1 })),
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    // Test modülünü oluştururken gerçek repository yerine mock objemizi kullanmasını söylüyoruz.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product), // TypeORM'un Product Repository token'ını sağlıyoruz
          useValue: mockProductRepository, // Simüle ettiğimiz objeyi kullan
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  // 1. Servisin başarıyla tanımlanıp tanımlanmadığını test et
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 2. Ürün ekleme fonksiyonunu test et
  it('should create a product and return it with an ID', async () => {
    const createProductDto = { name: 'Yeni Ürün', price: 50 };
    const userId = 1; // Test kullanıcısı ID'si
    const result = await service.create(createProductDto, userId);
    // Beklenen: mock objemiz bir id ekleyerek geri dönmeli
    expect(result).toEqual({ id: 1, name: 'Yeni Ürün', price: 50, userId });
    expect(mockProductRepository.save).toHaveBeenCalled(); // .save() çağrıldı mı?
  });

  // 3. Kullanıcıya ait ürünleri listeleme fonksiyonunu test et
  it('should return products by userId', async () => {
    const userId = 1;
    const result = await service.findByUserId(userId);
    expect(result).toHaveLength(1);
    expect(mockProductRepository.find).toHaveBeenCalledWith({ where: { userId } });
  });

  // 4. Tüm ürünleri listeleme fonksiyonunu test et
  it('should return an array of products', async () => {
    const result = await service.findAll();
    // Beklenen: mock objemizden dönen tek elemanlı dizi
    expect(result).toHaveLength(1);
    expect(mockProductRepository.find).toHaveBeenCalled();
  });

  // 5. Ürün silme fonksiyonunu test et
  it('should delete a product successfully', async () => {
    // İşlemi çağır
    const result = await service.remove(1); 
    
    // Beklenen: Silme başarılı olmalı ve delete metodu doğru ID ile çağrılmalı
    expect(mockProductRepository.delete).toHaveBeenCalledWith(1);
  });
});