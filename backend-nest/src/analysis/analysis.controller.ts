import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAnalysisDto } from './dto/create-analysis.dto';

@Controller('analysis')
@UseGuards(JwtAuthGuard)
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post()
  async createAnalysis(
    @Request() req,
    @Body() createAnalysisDto: CreateAnalysisDto,
  ) {
    // JWT payload'ına göre user id'yi al
    // sub: user.id olarak kaydedilmişti
    const userId = req.user.sub || req.user.userId || req.user.id;
    
    return this.analysisService.createAnalysis(
      userId,
      createAnalysisDto.githubUrl,
    );
  }

  @Get()
  async getUserAnalyses(@Request() req) {
    const userId = req.user.sub || req.user.userId || req.user.id;
    return this.analysisService.getUserAnalyses(userId);
  }

  @Get(':id')
  async getAnalysis(@Request() req, @Param('id') id: string) {
    const userId = req.user.sub || req.user.userId || req.user.id;
    return this.analysisService.getAnalysis(
      parseInt(id),
      userId,
    );
  }
}
