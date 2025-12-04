import { IsString, IsUrl } from 'class-validator';

export class CreateAnalysisDto {
  @IsString()
  @IsUrl({}, { message: 'Please provide a valid GitHub URL' })
  githubUrl: string;
}
