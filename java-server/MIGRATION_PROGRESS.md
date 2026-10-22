# Java 后端迁移进度（checkpoint）

> 目标：用 JDK8 + Spring Boot + MyBatis-Plus + MySQL + EasyExcel 无损替换 Node 后端，前端零改动。

## 环境（已完成）
- JDK: Zulu 8 (1.8.0_504) → `~/.jdks/zulu8.96.0.205-ca-jdk8.0.504-macosx_aarch64/Contents/Home`
- Maven: 3.9.9 → `~/.maven/apache-maven-3.9.9`
- MySQL: 26.10.0 运行中（`brew services start mysql`），库 `attendance_db`，root/root
- 驱动: mysql-connector-j 9.5.0
- 运行命令：
  ```
  export JAVA_HOME=~/.jdks/zulu8.96.0.205-ca-jdk8.0.504-macosx_aarch64/Contents/Home
  export PATH=$JAVA_HOME/bin:$HOME/.maven/apache-maven-3.9.9/bin:$PATH
  mvn -f /Users/gaolongfei/Desktop/study/attendance-system/java-server/pom.xml compile
  ```

## 已完成文件
- `pom.xml`（Spring Boot 2.7.18, MyBatis-Plus 3.5.5, EasyExcel 3.3.4, jjwt 0.9.1, mysql-connector-j 9.5.0）
- `src/main/resources/application.yml`（port 3000, snake_case, MySQL 连接, sql.init always）
- `src/main/resources/sql/schema.sql`（9 表 MySQL DDL）
- `common/`：UserContext, BizException, GlobalExceptionHandler
- `config/`：MybatisPlusConfig, InterceptorConfig, WebConfig(CORS), JwtProperties, JacksonConfig, DataInitializer(建 admin)
- `security/`：JwtUtil, AuthInterceptor, RequireRole
- `entity/` 9 个 + `mapper/` 9 个
- `util/`：BusinessRules, CsvUtil
- `controller/`：HealthController ✅, AuthController ✅, UsersController ✅

## 待写 Controller（按优先级）
1. TeamsController — list(+member_count,lead_name)/export/members/create/update
2. ProjectsController — list/create/update
3. HolidaysController — list/create/delete
4. OvertimeController — list/export/available
5. LeaveController — balance(5字段)/annual-init/annual-clear/export
6. AttendanceController — list(leaves)/batch/offset/export
7. LeaveDetailController — detail/overtime-detail
8. RequestsController — create/mine/review/dept-review/confirm + 3 action（审批状态机，最复杂）
9. DashboardController — summary（camelCase 响应，逐日明细）
10. ExcelController — parse-excel(base64)/import/template

## 关键契约要点（易错）
- 全局 snake_case；**dashboard/summary 用 camelCase**（userId/userName/employeeId/teamName/summary.*/dailyDetails.*）
- `GET /leave/:userId` 返回 5 字段：`{list, year, companyHireDate, tenureYears, canUseAnnual}`
- 审批状态机：create→needs_dept_manager=(leave&&days>=3)；review approve→pending_dept/approved；dept-review approve→approved；confirm→entered（扣余额/标记加班单位/混合拆2条）
- 错误返回 `{message: "..."}`，文案必须与 Node 逐字一致
- CSV：BOM + 双引号包裹 + "→""
- Excel：parse-excel 收 base64；import 收 JSON 数组；template 返回 xlsx blob

## 数据迁移（待做）
Node 脚本读 SQLite(server/data/attendance.db) → 写 MySQL，保留自增 ID、日期格式。

## 验证（待做）
复刻 server 118 用例为 JUnit + 跑 client 7 + e2e 7。
