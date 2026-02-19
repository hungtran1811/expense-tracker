export const copyVi = {
  brand: {
    name: "NEXUS OS",
    subtitle: "Không gian làm việc cá nhân của Hưng Trần",
    owner: "Hưng Trần",
  },
  nav: {
    dashboard: "Trung tâm",
    expenses: "Chi tiêu",
    goals: "Mục tiêu",
    videoPlan: "Kế hoạch video",
    accounts: "Tài khoản",
    settings: "Cài đặt",
  },
  routeMeta: {
    auth: {
      title: "Xin chào Hưng Trần",
      subtitle: "Đăng nhập để tiếp tục",
    },
    dashboard: {
      title: "Trung tâm",
      subtitle: "Ưu tiên nhà sáng tạo: video, mục tiêu, tài chính",
    },
    expenses: {
      title: "Chi tiêu",
      subtitle: "Theo dõi và tối ưu dòng tiền",
    },
    goals: {
      title: "Mục tiêu & Động lực",
      subtitle: "Duy trì tiến độ mỗi ngày",
    },
    "video-plan": {
      title: "Kế hoạch Video",
      subtitle: "Điều phối luồng YouTube 6 bước",
    },
    accounts: {
      title: "Tài khoản",
      subtitle: "Quản lý số dư và luồng tiền",
    },
    settings: {
      title: "Cài đặt",
      subtitle: "Hồ sơ và tùy chọn cá nhân",
    },
  },
  common: {
    guest: "Khách",
    month: "Tháng",
    loading: "Đang tải dữ liệu...",
    noData: "Chưa có dữ liệu",
    allAccounts: "Tất cả tài khoản",
    save: "Lưu",
    cancel: "Hủy",
    delete: "Xóa",
    edit: "Sửa",
    close: "Đóng",
    apply: "Áp dụng",
    reset: "Đặt lại",
  },
  cta: {
    addExpense: "+ Thêm khoản chi",
    addGoal: "Mở mục tiêu hôm nay",
    addVideoTask: "Thêm công việc video",
    openVideoBoard: "Mở bảng video",
    checkIn: "Điểm danh",
  },
  dashboard: {
    hero: {
      greeting: {
        morning: "Chào buổi sáng, {{name}}",
        afternoon: "Chào buổi chiều, {{name}}",
        evening: "Chào buổi tối, {{name}}",
      },
      missionTitle: "Nhiệm vụ hôm nay",
      missionDefault: "Giữ nhịp đều: hoàn thành 1 mục tiêu và đẩy 1 công việc video tiến lên.",
      missionHabit: "Bạn còn {{count}} lượt thói quen cần hoàn thành trong kỳ hiện tại.",
      missionVideo: "Bạn còn {{count}} công việc video chưa xuất bản. Ưu tiên đẩy sang bước kế tiếp.",
      quickActionsTitle: "Hành động nhanh",
      meta: "Trạng thái theo thời gian thực của tháng đang chọn",
    },
    priority: {
      title: "Ưu tiên hôm nay",
      empty: "Bạn đang đi đúng nhịp. Không có việc gấp cần xử lý ngay.",
      habitMeta: "{{done}}/{{target}} lượt • {{period}}",
      videoMetaNoDue: "Video chưa có hạn • {{stage}}",
      videoMetaDue: "Hạn {{dueDate}} • {{stage}}",
      actionCheckIn: "Điểm danh",
      actionOpenVideo: "Mở bảng video",
    },
    modules: {
      video: {
        title: "Luồng video tuần này",
        subtitle: "Ưu tiên xử lý các công việc sắp tới hạn.",
        link: "Mở bảng",
      },
      goals: {
        title: "Mục tiêu đang chạy",
        subtitle: "Theo dõi tiến độ và hoàn thành mục tiêu trọng tâm.",
        link: "Mở chi tiết",
      },
      motivation: {
        title: "Động lực",
        subtitle: "Thử thách ngày/tuần/tháng + XP + cấp độ.",
        link: "Xem thử thách",
      },
      accounts: {
        title: "Số dư tài khoản",
        empty: "Chưa có dữ liệu số dư tài khoản.",
      },
    },
    heroKpi: {
      videoOpen: "Việc video đang mở",
      habitLeft: "Lượt thói quen còn lại",
      activeGoals: "Mục tiêu đang chạy",
    },
  },
  goals: {
    status: {
      done: "Hoàn thành",
      active: "Đang chạy",
      reached: "Đã đạt",
    },
    table: {
      emptyGoals: "Chưa có mục tiêu nào.",
      emptyHabits: "Chưa có thói quen nào.",
    },
    dailyFocus: {
      title: "Hôm nay cần làm gì",
      subtitle: "Ưu tiên các thói quen còn thiếu quota để giữ chuỗi ngày.",
      empty: "Tuyệt vời! Bạn đã hoàn thành toàn bộ quota kỳ hiện tại.",
      action: "Điểm danh nhanh",
      remaining: "Còn {{remaining}} lượt",
    },
  },
  videoPlan: {
    filters: {
      title: "Bộ lọc bảng",
      stageAll: "Tất cả giai đoạn",
      priorityAll: "Tất cả ưu tiên",
      queryPlaceholder: "Tìm theo tiêu đề hoặc ghi chú...",
      reset: "Đặt lại",
      summary: "{{filtered}}/{{total}} công việc đang hiển thị",
    },
    form: {
      addTitle: "Tạo công việc video mới",
      editTitle: "Chỉnh sửa công việc video",
      noDeadline: "Không hạn",
      noNote: "Không có ghi chú",
      emptyBoard: "Chưa có công việc phù hợp bộ lọc.",
      emptySummary: "Chưa có công việc video.",
    },
    stage: {
      idea: "Ý tưởng",
      research: "Nghiên cứu",
      script: "Kịch bản",
      shoot: "Quay",
      edit: "Dựng",
      publish: "Xuất bản",
    },
    priority: {
      low: "Thấp",
      medium: "Vừa",
      high: "Cao",
    },
  },
  accounts: {
    transfer: "Chuyển tiền",
    addIncome: "Thêm thu nhập",
    addAccount: "Thêm tài khoản",
  },
  emptyState: {
    goals: "Chưa có mục tiêu đang chạy.",
    motivation: "Chưa có dữ liệu động lực.",
    video: "Chưa có công việc video.",
  },
  toast: {
    signInRequired: "Vui lòng đăng nhập trước",
    loadFail: "Không thể tải dữ liệu. Vui lòng thử lại.",
    deleteDataFail: "Không thể xóa dữ liệu",
    expenseAdded: "Đã thêm khoản chi.",
    expenseUpdated: "Đã cập nhật khoản chi.",
    expenseDeleted: "Đã xóa khoản chi.",
    expenseCreateFail: "Không thể thêm khoản chi",
    expenseUpdateFail: "Không thể cập nhật khoản chi",
    expenseNotFound: "Không tìm thấy khoản chi",
    expenseOpenFail: "Không thể mở khoản chi",
    incomeAdded: "Đã thêm khoản thu.",
    incomeUpdated: "Đã cập nhật khoản thu.",
    incomeDeleted: "Đã xóa khoản thu.",
    incomeCreateFail: "Không thể thêm khoản thu",
    incomeUpdateFail: "Không thể cập nhật khoản thu",
    incomeNotFound: "Không tìm thấy khoản thu",
    incomeOpenFail: "Không thể mở khoản thu",
    csvExportFail: "Xuất CSV thất bại.",
    csvExportSuccess: "Đã xuất CSV tháng hiện tại.",
    goalAdded: "Đã tạo mục tiêu mới.",
    goalCreateFail: "Không thể tạo mục tiêu",
    goalProgressUpdated: "Đã cập nhật tiến độ mục tiêu.",
    goalDoneXp: "Đã hoàn thành mục tiêu. +120 XP",
    goalDeleted: "Đã xóa mục tiêu.",
    goalUpdateFail: "Không thể cập nhật mục tiêu",
    habitAdded: "Đã tạo thói quen mới.",
    habitCreateFail: "Không thể tạo thói quen",
    habitNotFound: "Không tìm thấy thói quen",
    habitLocked: "Bạn đã đạt mục tiêu kỳ này",
    habitChecked: "Điểm danh thành công. +{{xp}} XP",
    habitDeleted: "Đã xóa thói quen.",
    habitUpdateFail: "Không thể cập nhật thói quen",
    videoAdded: "Đã thêm công việc video mới.",
    videoUpdated: "Đã cập nhật công việc video.",
    videoNotFound: "Không tìm thấy công việc video",
    videoDeleted: "Đã xóa công việc video.",
    videoCreateFail: "Không thể tạo công việc video",
    videoUpdateFail: "Không thể cập nhật công việc video",
    videoDeleteFail: "Không thể xóa công việc video",
    videoMoved: "Đã chuyển bước công việc video.",
    videoMoveFail: "Không thể chuyển bước",
    videoFilterSaved: "Đã cập nhật bộ lọc video.",
  },
};

export function t(path, fallback = "") {
  if (!path) return fallback;

  const chunks = String(path).split(".");
  let cur = copyVi;

  for (const key of chunks) {
    if (cur && Object.prototype.hasOwnProperty.call(cur, key)) {
      cur = cur[key];
    } else {
      return fallback;
    }
  }

  return cur ?? fallback;
}

export function formatTemplate(template, payload = {}) {
  let out = String(template || "");
  Object.entries(payload).forEach(([k, v]) => {
    out = out.replaceAll(`{{${k}}}`, String(v ?? ""));
  });
  return out;
}
