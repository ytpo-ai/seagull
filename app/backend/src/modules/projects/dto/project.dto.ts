import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  localDirectory?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  adminIds?: string[];

  @IsOptional()
  @IsString()
  externalLink?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  localDirectory?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  adminIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  externalLink?: string;
}

export class CreateApiKeyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  agentIds?: string[];
}

export class AssignAgentDto {
  @IsString()
  agentId: string;
}