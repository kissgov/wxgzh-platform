// 通用 API 响应类型
// ============================================================================

/** 统一 API 响应体 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  trace_id: string;
}

/** 分页请求参数 */
export interface PaginationParams {
  page: number;
  page_size: number;
}

/** 分页响应体 */
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}

/** 排序参数 */
export interface SortParams {
  sort?: string;
  order?: 'asc' | 'desc';
}
