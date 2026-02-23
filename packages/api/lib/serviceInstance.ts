import { VideoService } from './videoService';
import { creatifyProvider } from './creatifyProvider';

export const videoService = new VideoService(creatifyProvider);
