import type { ComponentType } from 'react'
import { HomeQinglan } from '@/components/appearances/qinglan/HomeQinglan'
import { CastQinglan } from '@/components/appearances/qinglan/CastQinglan'
import { ResultQinglan } from '@/components/appearances/qinglan/ResultQinglan'
import { HomeZhusha } from '@/components/appearances/zhusha/HomeZhusha'
import { CastZhusha } from '@/components/appearances/zhusha/CastZhusha'
import { ResultZhusha } from '@/components/appearances/zhusha/ResultZhusha'
import { HomeYehang } from '@/components/appearances/yehang/HomeYehang'
import { CastYehang } from '@/components/appearances/yehang/CastYehang'
import { ResultYehang } from '@/components/appearances/yehang/ResultYehang'
import type {
  CastAppearanceProps,
  HomeAppearanceProps,
  ResultAppearanceProps,
} from '@/components/appearances/shared/types'
import type { AppearanceId } from '@/lib/appearance'

/**
 * 外观 → 视图组件登记表。
 *
 * 页面只从这里取视图，不在自己的 JSX 里写 if/else 判断外观，
 * 新增外观时只改这一张表。
 */
export const HOME_VIEWS: Record<
  AppearanceId,
  ComponentType<HomeAppearanceProps>
> = {
  qinglan: HomeQinglan,
  zhusha: HomeZhusha,
  yehang: HomeYehang,
}

export const CAST_VIEWS: Record<
  AppearanceId,
  ComponentType<CastAppearanceProps>
> = {
  qinglan: CastQinglan,
  zhusha: CastZhusha,
  yehang: CastYehang,
}

export const RESULT_VIEWS: Record<
  AppearanceId,
  ComponentType<ResultAppearanceProps>
> = {
  qinglan: ResultQinglan,
  zhusha: ResultZhusha,
  yehang: ResultYehang,
}
