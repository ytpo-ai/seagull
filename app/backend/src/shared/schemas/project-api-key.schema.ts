import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProjectApiKeyDocument = ProjectApiKey & Document;

@Schema({ timestamps: true, collection: 'project_api_keys' })
export class ProjectApiKey {
  @Prop({ required: true, index: true })
  projectId: string;

  @Prop({ required: true })
  name: string;

  /** API Key 的 bcrypt/sha256 哈希值 */
  @Prop({ required: true })
  keyHash: string;

  /** API Key 明文前缀，用于 UI 展示识别（如 sk-proj-abc123...） */
  @Prop({ required: true })
  keyPrefix: string;

  /** 此 Key 可访问的 Agent ID 列表 */
  @Prop({ type: [String], default: [] })
  agentIds: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastUsedAt?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const ProjectApiKeySchema = SchemaFactory.createForClass(ProjectApiKey);

// 索引
ProjectApiKeySchema.index({ projectId: 1, isActive: 1 });
ProjectApiKeySchema.index({ keyHash: 1 }, { unique: true });