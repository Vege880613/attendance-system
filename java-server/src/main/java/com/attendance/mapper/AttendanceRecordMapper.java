package com.attendance.mapper;

import com.attendance.entity.AttendanceRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;

public interface AttendanceRecordMapper extends BaseMapper<AttendanceRecord> {

    /**
     * 按 (user_id, work_date) upsert 考勤记录（MySQL ON DUPLICATE KEY UPDATE）
     */
    @Insert("INSERT INTO attendance_records " +
            "(user_id, work_date, check_in, check_out, effective_hours, standard_hours, is_shortage, offset_type, offset_units, is_reset_before, remark, created_by) " +
            "VALUES (#{r.userId}, #{r.workDate}, #{r.checkIn}, #{r.checkOut}, #{r.effectiveHours}, 8.00, #{r.isShortage}, 'none', 0, 0, #{r.remark}, #{r.createdBy}) AS new " +
            "ON DUPLICATE KEY UPDATE check_in = new.check_in, check_out = new.check_out, " +
            "effective_hours = new.effective_hours, is_shortage = new.is_shortage, remark = new.remark, updated_by = new.created_by")
    int upsert(@Param("r") AttendanceRecord r);
}
