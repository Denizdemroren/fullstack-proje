import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // ZAP'ın taramayı başlatabilmesi için 3000'de bir 200 OK yanıtı döndürülmelidir.
  // Bu, "Failed to attack the URL" hatasını çözecektir.
  @Get()
  getHello(): string {
    return 'API is running successfully. ZAP can proceed with scanning.';
  }

  // Eğer `app.service.ts` dosyanızda özel bir `getHello()` varsa, bunu silin veya güncelleyin.
}