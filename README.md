# 人员考勤管理系统

全栈人员考勤管理系统，覆盖月度考勤管理、加班/休假申请审批、假期余额、人员班组管理、角色权限管理。

## 技术栈

| 层 | 技术 |
|----|------|
| **前端** | Vue 3 + Vite + Ant Design Vue 4 + Pinia + Vue Router + Axios + dayjs + xlsx |
| **后端** | Java 8 + Spring Boot 2.7 + MyBatis-Plus 3.5 + MySQL + EasyExcel + JWT(HS256) + BCrypt |
| **数据库** | MySQL 8.x（驱动 mysql-connector-j 9.5） |
| **测试** | JUnit5 + SpringBootTest（后端）· vitest（前端）· Playwright/Edge（E2E） |
| **部署** | Render（Java 后端）+ Vercel（前端静态站） |

> 原 Node.js + Express + SQLite 后端保留在 `server/` 供对照，生产使用 `java-server/`。

## 功能模块

1. **月度考勤管理** — 人工录入 / Excel 导入、未达标标红、加班/年假/调休/无责任抵扣
2. **加班工时管理** — 每 3 小时为 1 个加班单位，按单位整数抵扣
3. **假期管理** — 年假（按工龄分档初始化）、调休（加班单位折算）、无责任迟到/早退抵扣
4. **申请审批流程** — 员工发起 → 班组长审核 → （≥3 天请假需部门经理）→ 管理人员确认录入
5. **人员管理** — 入职/离职、班组分配、员工号
6. **班组管理** — 班组增删、班组长指派
7. **角色权限** — 员工 / 班组长 / 部门经理 / 管理人员

## 核心业务规则

- **加班**：每 3 小时 = 1 个加班单位；抵扣时 3 单位 = 1 整天，1–2 单位 = 0.5 天
- **年假**：入职满 1–10 年 5 天 / 10–20 年 10 天 / 20+ 年 15 天；每年 1 月 1 日初始化
- **调休**：由已审批的加班单位动态折算（应享天数 − 已用天数）
- **考勤标准**：08:20–17:00，有效工时 < 8.67 小时为短缺
- **无责任迟到/早退抵扣**：每月 **3 次**，迟到 **08:21–09:00**、早退 **16:21–17:00** 可用；
  一天内既迟到又早退按 **2 次**计；每月 1 日惰性重置

## 业务逻辑详解

### 1. 考勤与有效工时

- **标准工时**：08:20 上班、17:00 下班 = 8 小时 40 分钟 = **8.67 小时**
- **有效工时**：`max(上班打卡, 08:20)` 到 `下班打卡` 的时长，保留 2 位小数
  - 早于 08:20 打卡按 08:20 计（早到不额外加分）
  - 晚于 17:00 打卡不产生加班（加班需走加班申请）
- **短缺判定**：有效工时 `< 8.67` 即为短缺
- **每日状态优先级**（月度汇总）：`节假日 > 周末 > 请假 > 考勤记录 > 旷工`

| 状态 | 判定 |
|------|------|
| 节假日 | 当天为法定假日 |
| 休息 | 周末且非调休上班日 |
| 请假 | 当天落在已录入的请假申请区间内 |
| 正常 | 有打卡且有效工时 ≥ 8.67 |
| 缺卡 | 有效工时 > 0 但 < 8.67 |
| 旷工 | 无打卡记录（有效工时 = 0） |
| 年假抵扣 / 调休抵扣 / 正常-无责任 | 该日已用对应方式抵扣 |

### 2. 加班单位体系

加班以「单位」计量，是调休抵扣的最小颗粒：

- **生成**：加班申请审批通过后，按 `floor(加班小时 / 3)` 生成 `overtime_units`，每个单位固定 `hours=3.00`、`units_count=1`、`status=approved`
- **折算**：`floor(单位数 / 3)` 天 + 余数（1–2 单位）计 **0.5 天**
- **状态流转**：`pending`（申请中）→ `approved`（可抵扣）→ `used`（已用于调休）/ `cancelled`

### 3. 假期余额体系

| 类型 | 来源 | 说明 |
|------|------|------|
| `annual` 年假 | 按工龄分档，年初初始化 | 满 1 年 5 天 / 10 年 10 天 / 20 年 15 天 |
| `compensatory` 调休 | 由加班单位动态折算 | 应享天数 = 加班单位折算；剩余 = 应享 − 已用 |
| `no_fault` 无责任抵扣 | 每月固定 3 次 | 按「年 + 月」存储，读取时若月份不符自动重置 |
| `business_trip` 公差 / `other` 其他 | 无余额限制 | 仅作展示占位 |

**无责任抵扣规则**：
- 迟到 **08:21–09:00**（迟到 1–40 分钟）可用
- 早退 **16:21–17:00**（早退 1–39 分钟）可用
- 超出上述范围 → 不可用（提示「不在无责任抵扣范围内」）
- **一天内既迟到又早退 → 扣 2 次**（各计 1 次）
- 次数为 0 时 → 不可选，提示「本月无责任抵扣次数已用完」

### 4. 申请审批状态机

```
员工发起 ──► pending ──► 班组长审核 ──┬─ approve ─► approved ──► 管理员确认 ──► entered
                                      │                        ▲
                                      │                        └─ 加班申请直接生成单位
                                      └─ reject  ─► rejected

请假 ≥ 3 天：pending ──approve──► pending_dept ──部门经理 approve──► approved
```

- **加班申请**：审批通过即生成加班单位（无需管理员确认录入）
- **请假申请**：需走完整流程，管理员确认录入时才扣减对应假期余额
- **管理员确认**：`approved → entered`，此步骤才真正扣余额 / 标记加班单位为已用

### 5. 抵扣逻辑

| 抵扣方式 | 扣减对象 | 校验 |
|----------|----------|------|
| 年假抵扣 | `annual` 余额 +天数 | 余额充足、抵扣天数 > 0 |
| 调休抵扣 | 加班单位标记为 `used` + `compensatory` 余额 | 所选单位均为 approved、折算天数与抵扣天数一致 |
| 无责任抵扣 | `no_fault` 月度次数 +1（或 +2） | 迟到/早退时长在允许区间、剩余次数充足 |

**通用前置校验**：
- 日期必填
- 若当天已有**请假**记录（`type='leave'` 且 `status='entered'`）→ 不允许再抵扣
- 无打卡的旷工日不能用无责任抵扣（无迟到/早退数据）

### 6. 角色与数据可见性

| 角色 | 数据范围 | 典型权限 |
|------|----------|----------|
| `employee` | 仅本人 | 查看本人考勤/假期、发起申请 |
| `team_lead` | 本班组 | 审核本组待审批申请、查看班组汇总 |
| `dept_manager` | 本部门 | 审批 ≥3 天请假 |
| `manager` | 全部 | 人员/班组管理、考勤录入、抵扣、最终确认 |

### 7. 月度汇总

对每位员工逐日构建明细（共当月天数），并汇总：

- `workDays` 应出勤天数（排除周末）
- `normalDays` 正常天数
- `shortageDays` 缺卡天数（排除周末与旷工）
- `leaveDays` 请假天数
- `absentDays` 旷工天数
- `overtimeUnits` 可用加班单位数
- `annualLeaveRemaining` / `compLeaveRemaining` 年假 / 调休剩余

## 快速开始

### 1. 环境准备

- **JDK 8**（Apple Silicon 推荐 `brew install --cask zulu@8`）
- **Maven 3.9+**（`brew install maven`）
- **MySQL 8.x**（`brew install mysql && brew services start mysql`）

```bash
# 建库（开发 / 测试各一个）
mysql -u root -e "CREATE DATABASE attendance_db DEFAULT CHARACTER SET utf8mb4;"
mysql -u root -e "CREATE DATABASE attendance_test DEFAULT CHARACTER SET utf8mb4;"
```

### 2. 启动后端

```bash
cd java-server
mvn clean package -DskipTests
java -jar target/attendance-server.jar          # 端口 3000
```

- 连接 `127.0.0.1:3306/attendance_db`（root/root），可在 `src/main/resources/application.yml` 修改
- 启动时自动建表（`sql/schema.sql`）并创建默认管理员 **admin / admin123**

### 3. 启动前端

```bash
cd client
npm install
npm run dev                                      # 端口 5173
```

### 4. 访问

浏览器打开 http://localhost:5173 ，使用 `admin / admin123` 登录。

## 数据迁移

| 场景 | 脚本 |
|------|------|
| 原 SQLite 数据 → MySQL | `docs/migrate-sqlite-to-mysql.js` |
| 新增无责任抵扣（`month` 字段） | `docs/migrate-no-fault.sql` |

```bash
mysql -u root attendance_db < docs/migrate-no-fault.sql
```

## 测试

```bash
# 后端：96 个用例（JUnit5 + SpringBootTest，连 attendance_test）
cd java-server && mvn test

# 前端：7 个用例
cd client && npm test

# E2E：7 个用例（Playwright + Microsoft Edge，需前后端已启动）
npx playwright test
```

## 部署

| 目标 | 配置 | 说明 |
|------|------|------|
| 后端 | `render.yaml` | Render Java 服务，`SPRING_PROFILES_ACTIVE=production` |
| 前端 | `client/vercel.json` | Vercel 静态站，`/api/*` 重写到后端地址 |

生产环境通过环境变量覆盖数据库连接与 JWT 密钥（见 `application-prod.yml`）。

## 项目结构

```
attendance-system/
├── java-server/                     # Java 后端（生产）
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/attendance/
│       │   ├── controller/          # 13 组接口
│       │   ├── service/ · mapper/   # 业务 + 持久层
│       │   ├── entity/              # 9 张表实体
│       │   ├── security/            # JWT 拦截器 + @RequireRole
│       │   ├── common/              # 异常 + 用户上下文
│       │   ├── config/              # MyBatis-Plus / CORS / Jackson
│       │   └── util/                # BusinessRules / CsvUtil
│       └── resources/
│           ├── application.yml · application-prod.yml
│           └── sql/schema.sql
├── client/                          # Vue 3 前端
│   └── src/{api,stores,router,layouts,views,utils}
├── server/                          # 原 Node 后端（保留参考）
├── docs/                            # 迁移脚本
├── e2e/                             # Playwright E2E 用例
├── render.yaml                      # Render 部署配置
└── README.md
```

## 端到端测试流程

1. **管理员登录** → 班组管理创建班组 → 人员管理创建班组长和员工
2. **年假初始化** → 进入「年假初始化」页面，预览并确认
3. **员工登录** → 发起加班申请（如 7 小时 → 生成 2 个加班单位）
4. **班组长登录** → 审核通过加班申请
5. **管理员登录** → 确认录入（生成加班单位）
6. **管理员录入月度考勤** → 制造短缺数据（标红）
7. **管理员执行抵扣** → 用加班单位 / 年假 / **无责任抵扣** 抵扣短缺
8. **员工发起休假申请** → 消耗加班单位/年假 → 审核 → 录入
