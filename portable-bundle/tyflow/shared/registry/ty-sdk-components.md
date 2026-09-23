# @ty-sdk/components 组件知识库

来源：`C:\Users\tingyun\Desktop\project\tingyun-components`

扫描日期：2026-05-06

包名：`@ty-sdk/components`

版本：`0.5.36`

入口：`src/index.ts`

使用原则：

- 新页面开发前先查目标项目里有没有真实使用或二次封装，再查本文档决定是否引入组件库原始组件。
- 本文只记录源码、类型、Dumi 示例中能确认的信息；没有确认到的用法不写成结论。
- 图表优先使用组件库图表或项目现有 ECharts 封装，不把 Figma 图表画成静态 SVG。
- 表格、筛选、时间、页面容器、抽屉、空状态、提示、拓扑类能力优先复用本组件库。

## 导出组件总览

从 `src/index.ts` 确认的导出：

```ts
import {
  BarChart,
  PieChart,
  TyConfigProvider,
  TimeRangePicker,
  TyCustomTableHeader,
  TyDrawer,
  TyDrawerPro,
  TyEmpty,
  TyEntityInfo,
  TyEntityInfoCard,
  TyExportData,
  TyFilterSelect,
  TyMetricChartList,
  TyPageContainer,
  TySearch,
  TyTable,
  TyTooltip,
  TyTopInfo,
  TyTopSubmenu,
  TyAlarmTopo,
  TyApmTopo,
  TimeSeriesChart,
  HeatmapChart,
  TyDrawerUltra,
  TyIcon,
  TyFlow,
} from '@ty-sdk/components';
```

同时导出：

- `generateConfigProviderCfg` from `TyConfigProvider`
- `filterMetricTreeByCatIds`、`filterMetricTreeByEntityCode` from `TyMetricChartList`
- `TimeHistoryProvider`、`useTimeHistory` from `HeatmapChart`
- `TyDrawerUltra` 相关 context/util
- `TyFlow` 相关类型和工具
- `services`
- `utils`
- `TyIcon` 实际来自 `@ty-sdk/icons`

## 基础规范

### TyConfigProvider

来源：

- `src/TyConfigProvider/index.tsx`
- `src/TyConfigProvider/type.ts`
- `src/TyConfigProvider/index.md`

用途：

- 基于 Ant Design `ConfigProvider` 二次封装。
- 用于主题切换、国际化切换等全局配置。
- 页面示例中常作为外层包裹，如 `TyTable` 示例使用 `TyConfigProvider isMain={true}`。

导入：

```tsx
import { TyConfigProvider } from '@ty-sdk/components';
```

核心 Props：

```ts
type TyConfigProviderProps = ConfigProviderProps & {
  isMain?: boolean;
};
```

使用示例：

```tsx
<TyConfigProvider isMain={true}>
  <TyTable columns={columns} dataSource={data} />
</TyConfigProvider>
```

注意：

- 继承 antd `ConfigProviderProps`。
- `isMain` 表示是否主应用场景。

## 页面与查询组件

### TyPageContainer

来源：

- `src/TyPageContainer/index.tsx`
- `src/TyPageContainer/type.ts`
- `src/TyPageContainer/index.md`

用途：

- 配置型页面容器。
- 适合业务列表页、带左侧区域的页面、吸顶菜单页、搜索 + 表格页。
- 文档说明“目前运维管理平台深度使用”。

导入：

```tsx
import { TyPageContainer } from '@ty-sdk/components';
```

核心能力：

- `title` 标题区。
- `topHeaderRender` 吸顶区，可以传 ReactNode，也可以传 `TyTopSubmenuProps`。
- `leftSideRender` 左侧区域。
- `searchFields` 配置搜索项。
- `tableProps` 直接渲染 `TyTable`，优先级高于 `children`。
- `searchValues` 支持搜索值受控。

核心 Props：

```ts
type TyPageContainerProps = {
  title?: string | ReactNode | JSX.Element;
  toolbar?: ReactNode | JSX.Element;
  children?: ReactNode | JSX.Element;
  topHeaderRender?: TyTopSubmenuProps | ReactNode;
  leftSideRender?: ReactNode;
  leftSideWidth?: number;
  leftSideStyle?: React.CSSProperties;
  leftSideMark?: boolean;
  tableProps?: TyTableProps;
  pageStyle?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  contentHeaderStyle?: React.CSSProperties;
  contentBodyStyle?: React.CSSProperties;
  searchValues?: ISearchValue;
  searchFields?: ISearchFields[] | ReactNode;
  onSearchChange?: (arg: ISearchValue) => void;
  onSearchSubmit?: (arg: ISearchValue) => void;
  [key: string]: any;
};
```

搜索配置类型：

```ts
enum SearchTypeEnum {
  Input = 'input',
  Select = 'select',
  Button = 'button',
  BtnSubmit = 'btnSubmit',
}

type ISearchFields = {
  widgetType: SearchTypeEnum;
  fieldName: string;
  fieldLabel?: string;
  width?: number | string;
  [key: string]: any;
} & InputProps & SelectProps & ButtonProps;
```

基础使用：

```tsx
<TyPageContainer title="轻应用列表页" style={{ minHeight: 300 }}>
  <div>内容区</div>
</TyPageContainer>
```

搜索 + 表格：

```tsx
<TyPageContainer
  title="应用列表"
  searchFields={[
    {
      widgetType: SearchTypeEnum.Input,
      fieldName: 'name',
      fieldLabel: '应用名称',
      placeholder: '请输入应用名称',
      allowClear: true,
    },
    {
      widgetType: SearchTypeEnum.Select,
      fieldName: 'status',
      fieldLabel: '状态',
      options: [
        { value: 'all', label: '全部' },
        { value: 'enabled', label: '启用' },
      ],
    },
  ]}
  onSearchChange={setSearchValues}
  onSearchSubmit={handleSearch}
  tableProps={{
    columns,
    dataSource,
    rowKey: 'id',
  }}
/>
```

复用建议：

- 新增业务列表页优先考虑 `TyPageContainer + TyTable`。
- 如果页面已有复杂局部布局，可以只复用 `TyTable`、`TySearch`、`TyFilterSelect`，不用强行套容器。
- `topHeaderRender` 已经支持 `TyTopSubmenu`，轻应用顶部导航不要重复手写。

### TySearch

来源：

- `src/TySearch/index.tsx`
- `src/TySearch/type.ts`
- `src/TySearch/index.md`

用途：

- 定制搜索输入框。
- 基于 antd `InputProps`，额外提供 `onSearch`。
- 默认 `placeholder` 为 `I18nT('请输入')`。

导入：

```tsx
import { TySearch } from '@ty-sdk/components';
```

核心 Props：

```ts
type TySearchProps = InputProps & {
  onSearch?: (value: string) => void;
};
```

使用示例：

```tsx
<TySearch
  allowClear
  placeholder={I18nT('请输入应用名称')}
  onSearch={(value) => {
    setKeyword(value);
    reload();
  }}
/>
```

复用建议：

- 只有简单关键词搜索时用 `TySearch`。
- 多条件结构化筛选优先用 `TyFilterSelect`。
- 配置型页面搜索优先用 `TyPageContainer.searchFields`。

### TyFilterSelect

来源：

- `src/TyFilterSelect/index.tsx`
- `src/TyFilterSelect/type.ts`
- `src/TyFilterSelect/index.md`

用途：

- 多功能动态数据搜索查询框。
- 支持级联搜索、多级联动、URL 缓存搜索条件。
- 适合 APM/Explore 类多维筛选、字段 + 值的查询条件构造。

导入：

```tsx
import { TyFilterSelect } from '@ty-sdk/components';
```

最小使用：

```tsx
const getOptions = ({ tag, next }: TyGetOptionsEvent) => {
  if (tag.fieldKey) {
    next(valueOptions);
  } else {
    next(fieldOptions);
  }
};

<TyFilterSelect
  bindKey="value"
  bindLabel="name"
  bindValue="value"
  onChange={(tags, levels, cfg) => {
    setFilters(tags);
  }}
  getOptions={getOptions}
/>
```

核心 Props：

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `value` | `TyFilterTagType[]` | - | 受控模式 |
| `filterInputRef` | `MutableRefObject<TyFilterInputEvent \| undefined>` | - | 暴露手动增删 tag 的 ref |
| `bindKey` | `string` | `key` | 数据项 key 字段 |
| `bindLabel` | `string` | `label` | 数据项展示文本字段 |
| `bindValue` | `string` | `value` | 数据项 value 字段 |
| `bindType` | `string` | `type` | 数据项 type 字段 |
| `bindOther` | `string` | `other` | 其它字段 |
| `loading` | `boolean` | - | loading 交互 |
| `showIcon` | `boolean` | `true` | 是否显示过滤框 icon |
| `defaultTags` | `TyFilterTagType[]` | - | 默认展示 tag，首次加载会触发 change |
| `isQueryString` | `boolean` | `true` | 是否缓存搜索条件到 URL，优先级大于 `defaultTags` |
| `isEqual` | `boolean` | `false` | 是否过滤完全相等的 tag |
| `isDownBoxWelted` | `boolean` | `true` | 级联框是否贴边展示 |
| `isEnterClick` | `boolean` | `false` | 是否支持回车事件 |
| `isCacheClearedOnLanguageChange` | `boolean` | `true` | 国际化切换时是否清除缓存，`isQueryString=true` 时生效 |
| `formatQueryString` | `(tags) => tags` | - | 初始加载 URL 缓存时自定义过滤 |
| `onChange` | `(tags, levels, cfg) => void` | - | 条件变化回调 |
| `getOptions` | `(params) => void` | 必填 | 动态获取下拉数据 |

Tag 数据结构：

```ts
type TyFilterTagType = {
  key?: string;
  fieldLabel?: string | number;
  fieldKey?: string | number;
  fieldVal?: string | number;
  fieldType?: string | number;
  fieldOther?: string | number;
  valueLabel?: string;
  valueKey?: string | number;
  valueVal?: string | number;
  valueType?: string | number;
  valueOther?: string | number;
  disabled?: boolean;
  dataType?: 'multiple' | 'radio';
  filterType?: TyFilterEnum;
  [key: string]: any;
};
```

下拉类型：

```ts
type TyFilterEnum =
  | 'select'
  | 'enter'
  | 'doubleEnter'
  | 'textDoubleEnter'
  | 'statusCodeDoubleEnter'
  | 'polarUnion'
  | 'polarUnionHideLevelOne';
```

`getOptions` 参数：

```ts
type TyGetOptionsEvent = {
  inputValue: string;
  next: (
    options: TyFilterOptionType[] | ((obj: TyFilterCustomeEvent) => ReactNode | JSX.Element),
    cfg?: TyGetOptionsNextCfg,
  ) => void;
  tag: TyFilterTagType;
  levels: ILevelsType[];
  currentSelectIndex: number;
  eventType: 'input' | 'inputFocus' | 'mouseEnter' | 'click' | 'inputInline';
  filterType: TyFilterEnum;
  setTagByOption: (option?: TyFilterOptionType) => void;
  resetState: () => void;
};
```

`next` 配置：

```ts
type TyGetOptionsNextCfg = {
  filterType?: TyFilterEnum;
  dataType?: 'multiple' | 'radio';
  editIndex?: number;
};
```

Ref 方法：

```ts
type TyFilterInputEvent = {
  setTags: (value, isChange?: boolean) => void;
  getTags: () => TyFilterTagType[];
  addTag: (tag, isChange?: boolean) => void;
  addTagRadio: (tag, filterFn?, isChange?: boolean) => void;
  removeTag: (tag | key | predicate, isChange?: boolean) => void;
  addTagBatch: (tags, filterFn?, isChange?: boolean) => void;
  removeTagBatch: (tags, isChange?: boolean) => void;
  removeTagByIndex: (index, isChange?: boolean) => void;
  clearTag: (isChange?: boolean) => void;
};
```

常见场景：

```tsx
const filterInputRef = useRef<TyFilterInputEvent>();

filterInputRef.current?.addTag({
  fieldKey: 'systemIds',
  fieldLabel: '业务系统名称',
  valueKey: 4737,
  valueLabel: 'aspm-ldd-test',
});

filterInputRef.current?.addTagBatch([
  { fieldKey: 'userStatus', fieldLabel: '业务系统', valueKey: 1, valueLabel: 'apptest-1' },
  { fieldKey: 'highestVulLevel', fieldLabel: '风险等级', valueKey: 1, valueLabel: '低危' },
]);

filterInputRef.current?.clearTag();
```

级联示例规则：

- 首次聚焦或没有 `tag.fieldKey` 时返回字段列表。
- 选中一级后，根据 `tag.fieldKey` 返回二级选项。
- `filterType: 'polarUnion'` 表示级联。
- `filterType: 'polarUnionHideLevelOne'` 表示级联但隐藏一级。
- `editIndex` 只满足级联场景，用于指定替换某个面板的数据源。

已知注意点：

- 文档中明确记录了 `clearTag(false)` 的行为风险：`isChange=false` 时不触发 `onChange`，但 URL 仍可能更新。联动 URL 的页面不要随意传 `false`。
- `isQueryString` 默认是 `true`，如果页面不希望筛选条件进 URL，要显式传 `isQueryString={false}`。
- 字段映射不要猜，必须明确 `bindKey`、`bindLabel`、`bindValue` 与接口字段对应关系。

复用建议：

- 多维探索、APM 条件筛选优先用它。
- 普通列表页只有 1-2 个固定条件时，不一定要用它，可以用 `TyPageContainer.searchFields`。
- 接口联调时必须把 `TyFilterTagType` 到接口参数的映射单独写清楚。

## 表格组件

### TyTable

来源：

- `src/TyTable/index.tsx`
- `src/TyTable/type.ts`
- `src/TyTable/index.md`

用途：

- 基于 antd `Table` 二次封装。
- 支持列拖拽。
- 支持列配置缓存记忆。
- 支持 `TyEmpty` 空态配置。

导入：

```tsx
import { TyTable } from '@ty-sdk/components';
```

最小使用：

```tsx
<TyTable
  rowKey="id"
  columns={columns}
  dataSource={dataSource}
/>
```

列拖拽 + 宽度记忆：

```tsx
<TyTable
  storageName="explore-query-result"
  isColumnResize
  columns={columns}
  dataSource={dataSource}
/>
```

核心 Props：

```ts
type TyTableProps<T = any> = {
  isColumnResize?: boolean;
  storageName?: string;
  displayColumnKeys?: any[];
  size?: 'small' | 'middle' | 'large';
  columns: TyColumnsType<T>;
  showSorterTooltip?: boolean;
  emptyCfg?: TyEmptyProps;
  tableRef?: RefObject<ITableRef<T> | undefined>;
  [key: string]: any;
} & TableProps<T>;
```

列配置扩展：

```ts
interface TyColumnsType<T = any> extends ColumnType<T> {
  removePadding?: boolean;
  placeholder?: boolean;
  checked?: boolean;
  disabled?: boolean;
  minWidth?: number;
}
```

Ref：

```ts
type ITableRef<T = any> = {
  getAntTableRef: () => TableRef | null;
  getTableColumns: () => TyColumnsType<T>[];
};
```

使用注意：

- `storageName` 会把列宽、列配置存入 localStorage。命名建议：`微应用名-表格名`，例如 `explore-query-result`。
- `isColumnResize` 在列数大于 1 时才有意义。
- 可用 `minWidth` 控制拖拽模式下的最小列宽。
- `removePadding` 会移除单元格上下 padding，适合紧凑表格。
- `placeholder` 是拖拽模式内部占位列，业务代码一般不要主动使用。
- `emptyCfg` 传给 `TyEmpty`，用于统一空态。

复用建议：

- 新业务表格优先用 `TyTable`，不要直接用 antd `Table`，除非当前页面已经明确使用 antd 原生表格且不需要列宽记忆。
- 需要自定义列显示时，配合 `TyCustomTableHeader`。

### TyCustomTableHeader

来源：

- `src/TyCustomTableHeader/index.tsx`
- `src/TyCustomTableHeader/index.md`

用途：

- 自定义表头列显示配置。
- 与 `TyTable` 的列配置、storage 结构配套。
- 支持缓存和手动更新列配置。

导入：

```tsx
import { TyCustomTableHeader } from '@ty-sdk/components';
```

核心 Props：

```ts
type TyCustomTableHeaderProps = {
  storageName?: string;
  columns: TyColumnsType[];
  onColumnsChange?: (columnsKeys: string[]) => void;
  contentClassName?: string;
  tableHeaderRef?: MutableRefObject<ITableHeaderRef | undefined>;
  [key: string]: any;
};
```

Ref：

```ts
type ITableHeaderRef = {
  updateColumns: (columns: TyColumnsType[]) => void;
};
```

使用方式：

```tsx
const [displayColumnKeys, setDisplayColumnKeys] = useState<string[]>([]);

<TyCustomTableHeader
  storageName="explore-query-result"
  columns={columns}
  onColumnsChange={setDisplayColumnKeys}
/>

<TyTable
  storageName="explore-query-result"
  displayColumnKeys={displayColumnKeys}
  isColumnResize
  columns={columns}
  dataSource={dataSource}
/>
```

注意：

- `columns` 中 `disabled: true` 的列会被强制选中。
- 如果使用缓存，`storageName` 要和表格侧命名保持一致。
- 适合“用户可配置显示列”的业务表格。

## 时间组件

### TimeRangePicker

来源：

- `src/TimeRangePicker/index.tsx`
- `src/TimeRangePicker/type.ts`
- `src/TimeRangePicker/index.md`

用途：

- 时间范围选择器。
- 支持相对时间、时间跨度、定时器、粒度、上一时间范围、刷新、左右手柄、缓存读写。

导入：

```tsx
import { TimeRangePicker } from '@ty-sdk/components';
```

基础使用：

```tsx
<TimeRangePicker
  onChange={(time) => {
    setTime(time);
  }}
/>
```

核心 Props：

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `timeRef` | `MutableRefObject<ITimeRef \| undefined>` | - | 组件 ref |
| `defaultValue` | `RawInfoType` | - | 时间初始参数 |
| `value` | `RawInfoType` | - | 受控模式 |
| `disabled` | `boolean` | `false` | 禁用 |
| `size` | `'large' \| 'middle' \| 'small'` | `middle` | 尺寸 |
| `format` | `string` | `yyyy-MM-dd HH:mm` | change 输出格式 |
| `locale` | `'en-US' \| 'zh-CN'` | 系统国际化 | 国际化 |
| `maxValuesRange` | `number` | - | 最大时间范围，单位秒 |
| `showTimeSpan` | `boolean` | `true` | 时间跨度 |
| `showTimeInterval` | `boolean` | `true` | 定时器 |
| `showTimeGranularity` | `boolean` | `true` | 时间粒度 |
| `showTimePrevious` | `boolean` | `true` | 与前一时期比较 |
| `showHandShank` | `boolean` | `true` | 左右手柄 |
| `showRefresh` | `boolean` | `true` | 刷新 |
| `showGranularitySecond` | `boolean` | `true` | 粒度秒选项 |
| `mask` | `boolean` | `true` | 遮罩 |
| `isReadCache` | `boolean` | `true` | 读取 localStorage |
| `isWriteCache` | `boolean` | `true` | 写入 localStorage |
| `isRawValue` | `boolean` | 源码中确认存在 | 为 true 时 `onChange` 返回原始值 |
| `onChange` | `(obj: TimeRangePickerChange) => void` | - | 时间变化回调 |

输入值：

```ts
type RawInfoType = {
  startTime: string | number;
  endTime: string | number;
  granularity?: number;
  timeInterval?: number;
  timeSpanKey?: string;
  previous?: SelectOptions | null;
};
```

输出值：

```ts
type TimeRangePickerChange = {
  startTime: number;
  endTime: number;
  timePeriod: number;
  granularity: number;
  raw: RawInfoType;
  rawTime: {
    startTime: number;
    endTime: number;
    timePeriod: number;
  };
  previous: SelectOptions | null;
  isFrist: boolean;
  isRelative: boolean;
  isInterval: boolean;
  isControl: boolean;
};
```

Ref：

```ts
type ITimeRef = {
  refresh: () => void;
  refreshCache: () => void;
  setValue: (value?: RawInfoType) => void;
  resetTimeInfo: () => void;
};
```

使用建议：

- APM、Explore、图表页涉及查询时间时优先用它。
- 如果页面自己维护 URL 查询参数，要明确 `isReadCache`、`isWriteCache` 是否开启，避免缓存和路由状态冲突。
- 需要隐藏粒度/刷新/定时器时用对应 `show*` props，不要复制一个简化版时间组件。

## 抽屉组件

### TyDrawer

来源：

- `src/TyDrawer/index.tsx`
- `src/TyDrawer/type.ts`
- `src/TyDrawer/index.md`

用途：

- 基于 antd `Drawer` 二次封装。
- 支持拖拽宽度。
- 支持宽度 localStorage 记忆。

导入：

```tsx
import { TyDrawer } from '@ty-sdk/components';
```

核心 Props：

```ts
type ITyDrawerType = {
  onWidthChange?: (num: number) => void;
  storageKey?: string;
  minWidth?: number;
  dragContainerHandle?: string;
} & DrawerProps;
```

使用示例：

```tsx
<TyDrawer
  open={open}
  title={I18nT('详情')}
  width={720}
  minWidth={480}
  storageKey="explore-detail-drawer"
  onClose={handleClose}
>
  <Detail />
</TyDrawer>
```

注意：

- `storageKey` 用于宽度记忆。
- `dragContainerHandle` 用于指定拖拽相对容器的句柄。
- 只需要简单可拖拽详情抽屉时用 `TyDrawer`。

### TyDrawerPro

来源：

- `src/TyDrawerPro/index.tsx`
- `src/TyDrawerPro/type.ts`
- `src/TyDrawerPro/indexhiden.md`

用途：

- 抽屉内嵌 tab。
- 支持传路由、跨应用页面、组件内容。
- 继承 `TyDrawer` 的拖拽和宽度记忆能力。

导入：

```tsx
import { TyDrawerPro } from '@ty-sdk/components';
```

核心 Props：

```ts
type TyDrawerProProps = {
  title?: string;
  onClose: (params?: TabItemProps[]) => void;
  outletContent?: any;
  tabItem?: TabItemProps;
  onChangeIsRefreshPage?: (isRefreshPage: boolean) => void;
  drawerProRef?: any;
} & ITyDrawerType;
```

TabItem：

```ts
interface TabItemProps {
  micro?: true;
  uniqueKey?: number | string;
  appName: string;
  title?: string;
  icon?: any;
  path?: string;
  main?: string;
  component?: React.ReactNode;
  wujieParams?: {
    [key: string]: any;
  };
}
```

使用建议：

- 简单详情抽屉不要上 `TyDrawerPro`，用 `TyDrawer`。
- 需要在抽屉里打开多个详情页、跨应用页或组件页签时用它。
- `component` 和 `path` 不要混用；组件模式要给 `uniqueKey` 区分页面。

### TyDrawerUltra

来源：

- `src/TyDrawerUltra/index.ts`
- `src/TyDrawerUltra/src/index.tsx`
- `src/TyDrawerUltra/src/type.ts`
- `src/TyDrawerUltra/index.md`

用途：

- 更完整的多 tab 抽屉框架。
- 支持 `wujie`、`component`、`router` 三种 tab 类型。
- 支持 KeepAlive 缓存、缓存清理、激活事件、关闭广播、上下文添加 tab。

导入：

```tsx
import { TyDrawerUltra } from '@ty-sdk/components';
```

核心 Props：

```ts
type ITyDrawerUltraProps = {
  isDev?: boolean;
  dependentAppName?: string;
  drawerUltraRef?: MutableRefObject<ITyDrawerUltraRef | undefined | null>;
  defaultTabItems: ITyDrawerUltraTabItem[];
  wujieUrlSync?: boolean;
  outletContext?: OutletProps['context'];
  elCacheDs?: () => ITyElCacheDsType;
  onChangeTab?: (e: ITyDrawerUltraChangeEvent) => void;
  onChangeIsRefreshPage?: (isRefreshPage: boolean) => void;
} & ITyDrawerType;
```

TabItem：

```ts
interface ITyDrawerUltraTabItem {
  type: 'wujie' | 'component' | 'router';
  key: string;
  path?: string;
  component?: React.ReactNode | string;
  componentProps?: { [key: string]: any };
  title?: string;
  icon?: string;
  closable?: boolean;
  isCache?: boolean;
  wujieParams?: { [key: string]: any };
  otherParams?: { [key: string]: any };
}
```

Ref 常用方法：

```ts
type ITyDrawerUltraRef = {
  isInDrawerUltra: boolean;
  dependentAppName?: string;
  addTab: (tab: ITyDrawerUltraTabItem) => Promise<ITyDrawerUltraChangeEvent>;
  deleteTab: (key: string, redirectTabKey?: string, redirectDestroyCache?: boolean) => Promise<void> | undefined;
  deleteCurrentTab: (redirectTabKey?: string, redirectDestroyCache?: boolean) => Promise<void> | undefined;
  replaceCurrentTab: (tab: ITyDrawerUltraTabItem) => void;
  getTab: (key?: string) => ITyDrawerUltraTabItem | undefined;
  getTabList: () => ITyDrawerUltraTabItem[];
  getAliveController: () => AliveController;
  getActiveCacheId: () => string;
  rewriteActiveKey: (key?: string) => Promise<boolean | undefined>;
  clearCache: (tab: ITyDrawerUltraTabItem) => Promise<boolean>;
  clearCacheAll: () => Promise<boolean>;
  registerActivateAgainEvent: (key, callback) => () => void;
  registerCloseEventBus: (callback) => () => void;
  handleClose?: (callback: () => void) => Promise<void>;
};
```

使用建议：

- 多 tab、多来源、需要缓存控制的复杂详情抽屉用 `TyDrawerUltra`。
- 普通业务详情页不要直接用它，除非需求明确涉及缓存、跨应用或多 tab。
- `type='component'` 且 `component` 为字符串时，需要通过 `elCacheDs` 找对应异步组件。
- `key` 重复会覆盖之前打开的 tab，并销毁旧缓存。

## 状态与提示组件

### TyEmpty

来源：

- `src/TyEmpty/index.tsx`
- `src/TyEmpty/type.ts`
- `src/TyEmpty/index.md`

用途：

- 基于 antd `Empty` 二次封装。
- 扩展听云固定空态类型。

导入：

```tsx
import { TyEmpty } from '@ty-sdk/components';
```

核心 Props：

```ts
type TyEmptyProps = {
  type?: 'emptyError' | 'emptyFieldData' | 'emptyNotOpend';
} & EmptyProps;
```

使用示例：

```tsx
<TyEmpty type="emptyFieldData" description={I18nT('暂无数据')} />
<TyEmpty type="emptyError" description={I18nT('加载失败')} />
<TyEmpty type="emptyNotOpend" description={I18nT('功能未开通')} />
```

注意：

- 示例中出现过 `<TyEmpty type="Topo" />`，但当前 `type.ts` 只确认 `'emptyError' | 'emptyFieldData' | 'emptyNotOpend'`。新代码不要使用未被类型确认的 `Topo`，除非组件库类型已更新。
- 表格空态优先通过 `TyTable.emptyCfg` 传入。

### TyTooltip

来源：

- `src/TyTooltip/index.tsx`
- `src/TyTooltip/type.ts`
- `src/TyTooltip/index.md`

用途：

- 基于 antd `Tooltip` 的说明提示。
- 支持提示文案、文档跳转路径、自定义 tooltip 节点。

导入：

```tsx
import { TyTooltip } from '@ty-sdk/components';
```

核心 Props：

```ts
type TyTooltipProps = {
  hintText?: string | ReactNode;
  docPath?: string;
  children?: ReactNode;
  [key: string]: any;
} & TooltipProps;
```

使用示例：

```tsx
<TyTooltip
  hintText={I18nT('多维探索用于对可观测数据进行自由查询和分析')}
  placement="leftTop"
/>
```

使用建议：

- 页面标题旁说明、菜单说明、指标说明优先用它。
- 如果只需要 antd 原生 tooltip 行为，也可以直接用 antd `Tooltip`，但涉及文档入口时优先用 `TyTooltip`。

### TyExportData

来源：

- `src/TyExportData/index.tsx`
- `src/TyExportData/index.md`

用途：

- 导出数据按钮/图标能力。
- 支持 `xlsx`、`csv`。
- `getData` 支持异步获取二维数组。

导入：

```tsx
import { TyExportData } from '@ty-sdk/components';
```

核心 Props：

```ts
type TyExportDataProps = {
  name?: string;
  type?: 'xlsx' | 'csv';
  getData: () => Promise<any[][]>;
} & TyTooltipProps;
```

使用示例：

```tsx
<TyExportData
  name="query-result"
  type="xlsx"
  hintText={I18nT('导出为 Excel，最多支持导出 10,000 条')}
  getData={async () => {
    return [
      ['名称', '数量'],
      ...rows.map((row) => [row.name, row.count]),
    ];
  }}
/>
```

注意：

- 文档默认提示最多导出 10,000 条。
- `getData` 返回二维数组，第一行通常作为表头。

## 顶部导航与轻应用信息

### TyTopSubmenu

来源：

- `src/TyTopSubmenu/index.tsx`
- `src/TyTopSubmenu/type.ts`
- `src/TyTopSubmenu/index.md`

用途：

- 子应用吸顶 header。
- 支持应用标题、菜单、配置入口、文档入口、AI 对话入口。
- 可放进 `TyPageContainer.topHeaderRender`。

导入：

```tsx
import { TyTopSubmenu } from '@ty-sdk/components';
```

核心 Props：

```ts
type TyTopSubmenuProps<T = any> = {
  appInfo?: APP.dockAppInfo;
  menus?: APP.wuKongMenu[];
  activeMenu?: APP.wuKongMenu;
  tooltipProps?: TyTooltipProps;
  leftContent?: () => React.ReactNode;
  rightContent?: () => React.ReactNode;
  showConfig?: boolean;
  showDoc?: boolean;
  docPath?: string;
  showAiChat?: boolean;
  setAiChatContext?: (context: Record<string, any>, isInit?: boolean) => void;
  onTitleClick?: (appInfo, e) => void;
  onMenuSelect?: (menuInfo) => void;
  onConfigClick?: () => void;
  onOpenDoc?: (docPath?: string) => void;
  onOpenChat?: () => void;
  [key: string]: any;
};
```

菜单数据：

```ts
type wuKongMenu = {
  id: number;
  link?: string;
  title: string;
  parentId: number;
  productType?: number;
  env?: number;
  productTypeStr?: string;
  children: wuKongMenu[];
  [key: string]: any;
};
```

使用建议：

- 子应用顶部导航不要手写，优先用 `TyTopSubmenu`。
- 如果只是展示应用信息且不需要菜单，考虑 `TyTopInfo`。
- 非无界环境下需要手动传 `appInfo`、`menus`、`onOpenDoc` 等。

### TyTopInfo

来源：

- `src/TyTopInfo/index.tsx`
- `src/TyTopInfo/type.ts`
- `src/TyTopInfo/index.md`

用途：

- 子应用吸顶 header，可自定义左右侧内容。
- 比 `TyTopSubmenu` 更偏信息展示，不强调菜单能力。

导入：

```tsx
import { TyTopInfo } from '@ty-sdk/components';
```

核心 Props：

```ts
type TyTopInfoProps<T = any> = {
  onTitleClick?: (appInfo: dockAppInfo, e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  appInfo?: dockAppInfo;
  rightContent?: () => React.ReactNode;
  leftContent?: () => React.ReactNode;
  [key: string]: any;
};
```

使用建议：

- 需要展示应用标题、logo、右侧工具区域时用。
- 需要菜单选择、配置、文档、AI 对话入口时用 `TyTopSubmenu`。

## 实体与指标业务组件

### TyEntityInfo / TyEntityInfoCard

来源：

- `src/TyEntityInfo/index.tsx`
- `src/TyEntityInfo/typings.d.ts`
- `src/TyEntityInfo/index.md`

用途：

- 业务组件：实体信息。
- 展示实体标签列表、属性列表。
- `TyEntityInfoCard` 是卡片形态。

导入：

```tsx
import { TyEntityInfo, TyEntityInfoCard } from '@ty-sdk/components';
```

核心 Props：

```ts
type TyEntityInfoProps = {
  entityCode: string;
  entityId: string;
  showLink?: boolean;
  readonly?: boolean;
  className?: string;
  style?: Record<string, any>;
  onSaveEntityTag?: () => void;
};
```

使用示例：

```tsx
<TyEntityInfo
  entityCode="service"
  entityId={serviceId}
  showLink
  readonly={false}
  onSaveEntityTag={reloadEntityInfo}
/>
```

使用建议：

- 实体详情、服务详情、主机详情等需要标签/属性展示时优先使用。
- 如果接口没有实体 `entityCode` 和 `entityId`，不要硬套，需要先确认实体模型。

### TyMetricChartList

来源：

- `src/TyMetricChartList/index.tsx`
- `src/TyMetricChartList/typings.d.ts`
- `src/TyMetricChartList/index.md`

用途：

- 业务组件：指标图表列表。
- 左侧指标树，右侧图表。
- 支持按实体类型、指标分类、where/groupBy 条件过滤。

导入：

```tsx
import {
  TyMetricChartList,
  filterMetricTreeByCatIds,
  filterMetricTreeByEntityCode,
} from '@ty-sdk/components';
```

核心 Props：

```ts
type TyMetricChartListProps = {
  entityCode?: string;
  metricCatIds?: number[];
  filterList?: (
    | {
        entityId: string;
        entityCode: string;
        entityCodeName?: string;
      }
    | {
        k: string;
        op: string;
        v?: string;
        t: string;
        alias?: string;
        label?: string;
      }
  )[];
  time: any;
  setTime: () => void;
  className?: string;
  style?: Record<string, any>;
};
```

使用建议：

- 实体详情页需要指标树 + 指标图表时优先使用。
- `filterList` 支持实体条件和属性 where 条件两种结构，接接口前必须明确是哪一种。
- 可以用 `filterMetricTreeByEntityCode`、`filterMetricTreeByCatIds` 做指标树过滤。

## 图表组件

### BarChart

来源：

- `src/BarChart/index.tsx`
- `src/BarChart/index.md`
- `src/types/chart.ts`

用途：

- 分类柱状图。
- 适合分类对比场景。
- 基于 ECharts。

导入：

```tsx
import { BarChart } from '@ty-sdk/components';
```

数据结构：

```ts
type ChartData = {
  x: string | number | boolean;
  y: string | number | boolean;
  s: string | number | boolean;
  value?: string | number;
};
```

配置：

```ts
type BarChartConfig = {
  type?: 'vertical' | 'horizontal';
  size?: string | string[];
  legend?: {
    show?: boolean;
    position?: 'bottom' | 'right';
  };
  tooltip?: {
    show?: boolean;
  };
  label?: {
    show?: boolean;
  };
};
```

使用示例：

```tsx
<BarChart
  data={[
    { x: '服务A', y: 12, s: '错误数' },
    { x: '服务B', y: 20, s: '错误数' },
  ]}
  config={{
    type: 'vertical',
    legend: { show: true, position: 'bottom' },
  }}
  style={{ height: 400 }}
/>
```

注意：

- `data` 中 `s` 表示系列。
- `isDev={true}` 会在渲染前打印图表 option，便于调试。
- 可传 `onEvents`，继承 `echarts-for-react` 能力。

### PieChart

来源：

- `src/PieChart/index.tsx`
- `src/PieChart/index.md`
- `src/types/chart.ts`

用途：

- 饼图/环图。
- 适合占比场景。

导入：

```tsx
import { PieChart } from '@ty-sdk/components';
```

数据结构：

```ts
type PieData = {
  name: string;
  value: number;
};
```

配置：

```ts
type PieChartConfig = {
  type?: 'pie' | 'donut';
  size?: string | string[];
  custom?: PieChartConfigPieType | PieChartConfigDonutType | any;
};
```

使用示例：

```tsx
<PieChart
  data={[
    { name: '成功', value: 80 },
    { name: '失败', value: 20 },
  ]}
  config={{
    type: 'donut',
    custom: { rounded: 6 },
  }}
  style={{ height: 320 }}
/>
```

注意：

- 文档示例中 `custom.rounded` 有字符串 `'6px'` 写法，但类型定义是 `number`。新代码按类型传 `6`。

### TimeSeriesChart

来源：

- `src/TimeSeriesChart/TimeSeriesChart.tsx`
- `src/TimeSeriesChart/types.d.ts`
- `src/TimeSeriesChart/index.md`

用途：

- 时序图。
- 支持 line、area、bar。
- 支持系列选中、刷选时间、BubbleUp、放大时间等观测场景交互。

导入：

```tsx
import { TimeSeriesChart } from '@ty-sdk/components';
```

数据结构：

```ts
data: {
  name: string;
  color?: string;
  data: {
    x: string | number | boolean;
    y: string | number | boolean;
  }[];
}[]
```

核心配置：

```ts
config: {
  chartType?: 'line' | 'area' | 'bar';
  identifier?: string;
  select: API.QueryParamSelect;
  disabled?: boolean;
  hideBubbleUp?: boolean;
  hideChangeTime?: boolean;
  hideUnit?: boolean;
  time: {
    start: number;
    end: number;
    duration?: number;
    timeNum: number;
    timeUnit: 'seconds' | 'minutes' | 'hours' | 'days';
  };
}
```

事件：

```ts
onChartReady?: (instance) => void;
onTimeChange?: (params: { start: number; end: number; action?: 'brush' | 'return' }) => void;
onBubbleUp?: (params: Record<string, any>) => void;
onBrush?: (params: Record<string, any>) => void;
```

使用建议：

- 指标趋势、请求量、错误率等时间序列优先用它。
- 需要 BubbleUp/刷选/放大时间时，不要自己封装 ECharts。
- `config.select` 是必须项，接入前要确认 API 查询参数结构。

### HeatmapChart

来源：

- `src/HeatmapChart/HeatmapChart.tsx`
- `src/HeatmapChart/types.d.ts`
- `src/HeatmapChart/index.md`

用途：

- 热力图。
- 支持 Brush、BubbleUp、放大时间。
- 导出 `TimeHistoryProvider` 和 `useTimeHistory`。

导入：

```tsx
import { HeatmapChart, TimeHistoryProvider, useTimeHistory } from '@ty-sdk/components';
```

数据结构：

```ts
data: {
  name: string;
  data: {
    x: number;
    y: number[];
  }[];
}[]
```

核心配置：

```ts
config: {
  identifier?: string;
  select?: QueryParamSelect;
  hideBubbleUp?: boolean;
  hideBrush?: boolean;
  hideChangeTime?: boolean;
  time: {
    start: number;
    end: number;
    duration?: number;
    timeNum: number;
    timeUnit: 'seconds' | 'minutes' | 'hours' | 'days';
  };
  heatmap: {
    min: number;
    max: number;
    step: number;
  };
}
```

使用建议：

- 分布热力、延迟分布、状态码分布这类二维时间分布图优先用。
- `heatmap.min/max/step` 是必需业务参数，不能随意默认。

## 拓扑与图形组件

### TyFlow

来源：

- `src/TyFlow/src/index.tsx`
- `src/TyFlow/type.ts`
- `src/TyFlow/index.md`

用途：

- D3 图形化树状控件。
- 支持左/右双向树、root 居中、节点折叠、操作弹框、自定义节点、连线文案、自定义图标、节点事件。

导入：

```tsx
import { TyFlow } from '@ty-sdk/components';
```

数据结构规则：

```ts
type TyCustomeField<T> = {
  level: number;
  name?: string;
  children?: TyCustomeField<T>[];
  parents?: TyCustomeField<T>[];
  y: number;
  x: number;
  nodeKey: string;
  parentNodeKey: string | null;
  nodeType: 'left' | 'root' | 'right';
  active?: boolean;
  otherChildren?: TyCustomeField<T>[];
  initOthersInfo?: TyCustomeField<T>[];
  isCurrent?: boolean;
  _children?: TyCustomeField<T>[];
  [key: string]: any;
} & T;
```

业务传入数据至少要能映射：

- `level`：节点层级，root 为 1。
- `name`：默认节点标题。
- `icon`：图标标识，可通过 `fieldMapCfg` 映射。
- `children`：root 右侧节点。
- `parents`：root 左侧节点。

核心 Props：

```ts
interface TYFlowProps<T> {
  flowRef?: MutableRefObject<TyFlowInstDsType | undefined>;
  treeSourceData: T | null;
  loading?: boolean;
  style?: React.CSSProperties;
  rootIsCenter?: boolean;
  popoverCfg?: TyFlowPopverCfg<T>;
  edgeTextCfg?: TyFlowEdgeTextCfg<T>;
  nodeCfg?: TyFlowNodeCfg<T>;
  attrCfg?: TyFlowAttrCfg;
  iconMapCfg?: TyFlowIconMapCfg;
  fieldMapCfg?: TyFieldMapCfg;
  onNodeClick?: (d, getFlowInstDs) => TyNodeClickReturnType | void;
  onNodeBlur?: (d, getFlowInstDs) => void;
  onNodeMouseEnter?: (d, nodes, getFlowInstDs) => void;
  onNodeMouseLeave?: (d, nodes, getFlowInstDs) => void;
  [key: string]: any;
}
```

基础使用：

```tsx
const flowRef = useRef<TyFlowInstDsType>();

<TyFlow
  flowRef={flowRef}
  treeSourceData={treeData}
  rootIsCenter
  style={{ height: 500 }}
  onNodeClick={(node) => {
    setSelectedNode(node.data);
  }}
/>
```

常用配置：

```tsx
<TyFlow
  treeSourceData={treeData}
  fieldMapCfg={{
    name: 'serviceName',
    icon: 'serviceType',
  }}
  iconMapCfg={{
    Java: 'Java',
    MySQL: 'MySQL',
  }}
  edgeTextCfg={{
    top: {
      text: (line) => line.target.data.callCount,
    },
  }}
/>
```

使用建议：

- 树状依赖、调用链路、左右拓扑类页面优先评估 `TyFlow`。
- 如果数据天然是 G6 图数据 `{ nodes, edges }`，优先看 `TyApmTopo` / `TyAlarmTopo`。
- 自定义节点时用 `nodeCfg.nodeInnerRule.render`，不要复制整套 D3 逻辑。

### TyApmTopo

来源：

- `src/TyApmTopo/index.tsx`
- `src/TyApmTopo/type.ts`
- `src/TyApmTopo/index.md`

用途：

- APM 横向拓扑。
- 基于 `@antv/g6`。
- 支持节点、边、画布点击。

导入：

```tsx
import { TyApmTopo } from '@ty-sdk/components';
```

核心 Props：

```ts
type TyApmTopoProps = {
  data?: GraphData | any;
  dataTransformName?: 'transformApmTopoData';
  onNodeClick?: (node: Record<string, any>) => void;
  onEdgeClick?: (edge: Record<string, any>) => void;
  onCanvasClick?: () => void;
  selectedNodeId?: string;
};
```

使用示例：

```tsx
<TyApmTopo
  data={topoData}
  selectedNodeId={selectedNodeId}
  onNodeClick={(node) => setSelectedNodeId(node.id)}
  onEdgeClick={(edge) => setSelectedEdge(edge)}
  onCanvasClick={() => setSelectedNodeId(undefined)}
/>
```

使用建议：

- APM 服务拓扑优先用它。
- 如果接口不是组件期望结构，先确认是否能使用 `transformApmTopoData`，不要在页面里重新画拓扑。

### TyAlarmTopo

来源：

- `src/TyAlarmTopo/index.tsx`
- `src/TyAlarmTopo/type.ts`
- `src/TyAlarmTopo/index.md`

用途：

- 告警微应用中的横向拓扑。
- 基于 `@antv/g6`。

导入：

```tsx
import { TyAlarmTopo } from '@ty-sdk/components';
```

核心 Props：

```ts
type TyAlarmTopoProps = {
  data?: GraphData | { nodes: any[]; edges: any[] };
  dataTransformName?: 'transformAlarmTopoData';
  onNodeClick?: (node: Record<string, any>) => void;
  selectedNodeId?: string;
};
```

使用建议：

- 告警相关横向拓扑优先用它。
- 只有节点点击，没有边点击和画布点击 props；需要这些能力时先看源码是否应扩展组件，而不是页面绕开。

## 图标

### TyIcon

来源：

- `src/TyIcon/index.ts`

用途：

- 直接转导 `@ty-sdk/icons`。

导入：

```tsx
import { TyIcon } from '@ty-sdk/components';
```

源码确认：

```ts
export { default as TyIcon } from '@ty-sdk/icons';
export * from '@ty-sdk/icons';
```

使用建议：

- 听云业务图标优先查 `@ty-sdk/icons`，不要临时复制 SVG。
- 对具体图标名不确定时，先在组件库或图标包里搜索。

## 开发决策表

| 需求场景 | 优先组件 | 不建议 |
| --- | --- | --- |
| 普通业务列表页 | `TyPageContainer` + `TyTable` | 直接从零搭布局和表格 |
| 表格列宽拖拽/记忆 | `TyTable` | 原生 antd Table 手写拖拽 |
| 用户配置显示列 | `TyCustomTableHeader` + `TyTable` | 页面内自己维护 localStorage |
| 简单关键词搜索 | `TySearch` | 为一个输入框上 `TyFilterSelect` |
| 多维筛选/字段值筛选 | `TyFilterSelect` | 手写复杂 tag 输入框 |
| 查询时间范围 | `TimeRangePicker` | 自己拼 DatePicker + 粒度 + 缓存 |
| 简单详情抽屉 | `TyDrawer` | 直接 antd Drawer 且重复写宽度拖拽 |
| 多 tab/跨应用/缓存抽屉 | `TyDrawerUltra`，必要时 `TyDrawerPro` | 页面内手写复杂 tab 抽屉 |
| 空态/错误态/未开通 | `TyEmpty` | 每个页面单独画空态 |
| 标题说明/文档入口 | `TyTooltip` | 手写 Tooltip + 文档跳转 |
| 数据导出 | `TyExportData` | 每页重复写 xlsx/csv 导出 |
| 子应用顶部菜单 | `TyTopSubmenu` | 手写 header/menu/doc/AI 入口 |
| 子应用顶部信息 | `TyTopInfo` | 重复写应用标题和左右内容 |
| 实体标签/属性 | `TyEntityInfo` / `TyEntityInfoCard` | 页面内重新拼实体属性卡 |
| 实体指标图表列表 | `TyMetricChartList` | 重新写指标树和图表列表 |
| 分类柱状图 | `BarChart` | 直接手写基础 ECharts option |
| 占比图 | `PieChart` | 直接手写基础 ECharts option |
| 时序指标图 | `TimeSeriesChart` | 手写带 BubbleUp/刷选的时序图 |
| 热力图 | `HeatmapChart` | 手写二维热力和刷选逻辑 |
| D3 树状拓扑 | `TyFlow` | 从零写 D3 树 |
| APM G6 拓扑 | `TyApmTopo` | 从零写 G6 服务拓扑 |
| 告警 G6 拓扑 | `TyAlarmTopo` | 从零写告警拓扑 |

## Tyflow 接入规则

后续执行 `前端工作流` / `$tyflow-do` 时，组件复用阶段按这个顺序：

1. 先在目标项目中查有没有同类页面、同类组件、同名组件引入、局部二次封装或业务封装。
2. 如果目标项目已经使用过组件库组件，优先仿照项目里的真实用法，包括 import 路径、外层容器、样式类、字段转换、ref 使用、缓存命名、空态/加载态处理。
3. 如果目标项目有二次封装，优先使用二次封装；不要绕过封装直接引入组件库原始组件，除非能说明封装不适用。
4. 如果目标项目没有用过，再查本文档和组件库源码，按组件库原始方式接入。
5. 只有组件不适用、二次封装不适用，或复用成本明显高于收益时，才新增页面局部组件。

落地要求：

- 引入组件前写清楚“为什么用这个组件”。
- 复用判断必须记录：项目内是否已有用法、是否存在二次封装、最终采用“仿照项目用法 / 使用项目封装 / 使用组件库原始方式 / 新写局部组件”中的哪一种。
- 如果不用本文档中明显相关的组件，需要记录原因。
- 接口字段映射不明确时，不允许为了套组件猜字段。
- 图表和拓扑必须先确认数据结构是否能适配已有组件。

## 待后续补扫

这些内容当前没有展开到完整源码级说明，后续有对应需求时应补充：

- `services` 模块：目前只确认从入口导出，未逐个记录接口函数。
- `utils` 模块：目前只确认从入口导出，未逐个记录工具函数。
- `TyFlow` 的全部 `attrCfg` 默认值和自定义 render 示例。
- `TyDrawerUltra` context/util 的完整调用范式。
- `TyMetricChartList` 内部服务依赖和指标树数据来源。
- `@ty-sdk/icons` 图标名索引。
