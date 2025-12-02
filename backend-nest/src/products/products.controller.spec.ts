import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';

// Mock repository
const mockProductRepository = {
  save: jest.fn(product => Promise.resolve({ id: 1, ...product })),
  find: jest.fn(() => Promise.resolve([{ id: 1, name: 'Test Ürün', price: 100 }])),
  findOneBy: jest.fn((options) => {
    if (options.id === 1) {
      return Promise.resolve({ id: 1, name: 'Test Ürün', price: 100 });
    }
    return Promise.resolve(null);
  }),
  create: jest.fn(product => product),
  update: jest.fn(() => Promise.resolve({ affected: 1 })),
  delete: jest.fn(() => Promise.resolve({ affected: 1 })),
};

describe('ProductsController', () => {
  let controller: ProductsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
