import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProjectDocument = Project & Document;

@Schema({ timestamps: true, collection: 'projects' })
export class Project {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  /** 绑定的本地目录路径 */
  @Prop()
  localDirectory?: string;

  /** 项目管理员 Employee ID 列表 */
  @Prop({ type: [String], default: [] })
  adminIds: string[];

  @Prop({ default: true })
  isActive: boolean;

  /** 外部链接地址 */
  @Prop()
  externalLink?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

// 索引
ProjectSchema.index({ name: 1 });
ProjectSchema.index({ adminIds: 1 });
ProjectSchema.index({ isActive: 1 });
ProjectSchema.index({ adminIds: 1, isActive: 1 });