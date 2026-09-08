// ============================================================
// i18n — Hệ thống đa ngôn ngữ toàn diện cho Masita
// Hỗ trợ: Tiếng Việt (vi) và English (en)
// ============================================================

import { useAppSettings } from '../store/appSettingsStore';

export type AppLanguage = 'vi' | 'en';

export const translations = {
  vi: {
    // Navigation tabs
    home: 'Trang chủ',
    friends: 'Bạn bè',
    messages: 'Tin nhắn',
    profile: 'Hồ sơ',

    // Feed & Posts
    feed_title: 'Khám phá',
    feed_all: 'Tất cả',
    feed_friends: 'Bạn bè',
    feed_search_placeholder: 'Tìm kiếm bài viết, chú thích...',
    feed_empty: 'Chưa có bài viết nào',
    feed_empty_desc: 'Hãy là người đầu tiên chia sẻ khoảnh khắc!',
    create_post: 'Đăng ảnh',
    new_moment: 'Khoảnh khắc mới',
    like: 'Thích',
    liked: 'Đã thích',
    comment: 'Bình luận',
    comments: 'Bình luận',
    share: 'Chia sẻ',
    post_options: 'Tùy chọn bài viết',
    save_post: 'Lưu bài viết',
    save_post_desc: 'Lưu vào bộ sưu tập bài viết trên trang cá nhân',
    unsave_post: 'Bỏ bài viết',
    unsave_post_desc: 'Bỏ lưu bài viết khỏi mục Đã lưu',
    repost_post: 'Đăng lại',
    repost_post_desc: 'Chia sẻ lại bài viết lên trang cá nhân của bạn',
    unrepost_post: 'Hủy đăng lại',
    unrepost_post_desc: 'Gỡ bài viết khỏi danh sách Đăng lại',
    edit_post: 'Chỉnh sửa bài viết',
    delete_post: 'Xóa bài viết',
    confirm_delete_post: 'Bạn có chắc chắn muốn xóa bài viết này?',
    public: 'Công khai',
    friends_only: 'Bạn bè',
    private: 'Chỉ mình tôi',
    write_caption: 'Viết chú thích cho ảnh...',
    who_can_see: 'Ai có thể xem khoảnh khắc này?',
    post_now: 'Đăng ngay',

    // Comments Modal
    comments_title: 'Bình luận',
    comments_empty: 'Chưa có bình luận nào. Hãy gửi lời đầu tiên!',
    write_comment: 'Viết bình luận...',
    reply: 'Trả lời',
    replying_to: 'Đang trả lời',
    cancel_reply: 'Hủy',
    send: 'Gửi',
    pin_comment: 'Ghim bình luận',
    unpin_comment: 'Bỏ ghim',
    delete_comment: 'Xóa bình luận',

    // Friends Screen
    friends_title: 'Bạn bè',
    tab_my_friends: 'Danh sách',
    tab_suggestions: 'Gợi ý',
    tab_requests: 'Lời mời',
    search_friends_placeholder: 'Tìm kiếm bạn bè...',
    add_friend: 'Kết bạn',
    request_sent: 'Đã gửi lời mời',
    cancel_request: 'Hủy lời mời',
    accept: 'Chấp nhận',
    decline: 'Từ chối',
    unfriend: 'Hủy kết bạn',
    no_friends: 'Chưa có bạn bè nào',
    no_suggestions: 'Không có gợi ý kết bạn nào',
    no_requests: 'Không có lời mời kết bạn nào',
    search_users: 'Tìm kiếm người dùng',
    search_users_placeholder: 'Nhập tên, username hoặc email...',

    // Messages Screen
    messages_title: 'Tin nhắn',
    tab_direct: 'Trực tiếp',
    tab_groups: 'Nhóm',
    search_messages_placeholder: 'Tìm kiếm cuộc trò chuyện...',
    create_group: 'Tạo nhóm',
    no_conversations: 'Chưa có cuộc trò chuyện nào',
    no_groups: 'Chưa tham gia nhóm nào',
    pinned: 'Đã ghim',
    muted: 'Đã tắt thông báo',

    // Chat & Group Chat
    type_message: 'Nhập tin nhắn...',
    type_group_message: 'Nhập tin nhắn nhóm...',
    online: 'Đang hoạt động',
    offline: 'Ngoại tuyến',
    members: 'thành viên',
    group_info: 'Thông tin nhóm',
    search_chat: 'Tìm kiếm',
    pin_chat: 'Ghim trò chuyện',
    pin_group: 'Ghim nhóm',
    unpin_chat: 'Bỏ ghim',
    mute_notifications: 'Tắt thông báo',
    unmute_notifications: 'Bật thông báo',
    muted_status: 'Đã tắt TB',
    unmuted_status: 'Bật TB',
    theme_and_wallpaper: 'Theme & Hình nền nhóm',
    chat_theme: 'Giao diện & Hình nền',
    take_photo: 'Chụp ảnh',
    photo_library: 'Thư viện ảnh',
    choose_file: 'Chọn tệp tin',
    remove_wallpaper: 'Gỡ nền',
    featured_wallpapers: 'Gợi ý hình nền nổi bật:',
    trending_wallpapers: 'Gợi ý hình nền thịnh hành:',
    member_list: 'Danh sách thành viên',
    add_member: '＋ Thêm',
    group_admin: '👑 Trưởng nhóm',
    group_member: 'Thành viên',
    remove_member: 'Xóa',
    leave_group: '🚪 Rời khỏi nhóm',
    confirm_leave_group: 'Bạn có chắc chắn muốn rời nhóm này?',
    readable_file: '📖 Có thể đọc',
    download_file: 'Tải tệp tin',
    updating_wallpaper: 'Đang cập nhật hình nền...',

    // Profile Screen
    posts_stat: 'Bài viết',
    friends_stat: 'Bạn bè',
    likes_stat: 'Lượt thích',
    edit_profile: 'Chỉnh sửa hồ sơ',
    bio_placeholder: 'Chưa có tiểu sử',
    my_posts: 'Bài viết',
    saved_posts: 'Đã lưu',

    // Settings
    settings: 'Cài đặt',
    account: 'Tài khoản',
    privacy: 'Quyền riêng tư',
    security: 'Bảo mật và đăng nhập',
    share_profile: 'Chia sẻ hồ sơ',
    display: 'Nội dung hiển thị',
    notifications: 'Thông báo',
    appearance: 'Hiển thị',
    language: 'Ngôn ngữ',
    accessibility: 'Trợ năng',
    support: 'Hỗ trợ giới thiệu',
    help_center: 'Trung tâm trợ giúp',
    privacy_center: 'Trung tâm quyền riêng tư',
    terms: 'Điều khoản và chính sách',
    version: 'Phiên bản cập nhật',

    // Settings Sub-pages
    account_settings: 'Cài đặt tài khoản',
    edit_account: 'Chỉnh sửa tài khoản',
    change_username: 'Đổi tên người dùng',
    change_email: 'Đổi địa chỉ Email',
    change_password: 'Đổi mật khẩu',
    current_username: 'Username hiện tại',
    new_username: 'Username mới',
    current_email: 'Email hiện tại',
    new_email: 'Email mới',
    current_password: 'Mật khẩu hiện tại',
    new_password: 'Mật khẩu mới',
    confirm_new_password: 'Xác nhận mật khẩu mới',
    privacy_settings: 'Cài đặt quyền riêng tư',
    private_account: 'Tài khoản riêng tư',
    private_account_desc: 'Chỉ bạn bè mới xem được các bài viết và khoảnh khắc của bạn',
    public_account_desc: 'Mọi người đều có thể xem bài viết công khai của bạn',
    suggest_account: 'Đề xuất tài khoản',
    suggest_account_desc: 'Cho phép gợi ý tài khoản của bạn cho người khác',
    stranger_find_you: 'Người lạ tìm kiếm bạn',
    find_by_name: 'Tìm qua Tên hiển thị',
    find_by_username: 'Tìm qua Username',
    find_by_email: 'Tìm qua Email',
    security_settings: 'Bảo mật và đăng nhập',
    two_factor: 'Xác thực 2 yếu tố (2FA)',
    two_factor_desc: 'Bảo vệ tài khoản bằng mã xác nhận gửi về email khi đăng nhập',
    active_sessions: 'Thiết bị đang đăng nhập',
    logout_other_devices: 'Đăng xuất tất cả thiết bị khác',

    // Theme
    dark_mode: 'Chế độ tối',
    light_mode: 'Chế độ sáng',
    theme_dark: 'Giao diện tối (Dark Mode)',
    theme_light: 'Giao diện sáng (Light Mode)',

    // Notifications Settings
    notify_messages: 'Tin nhắn mới',
    notify_messages_desc: 'Nhận thông báo khi có tin nhắn mới',
    notify_posts: 'Bài viết mới',
    notify_posts_desc: 'Thông báo khi bạn bè đăng khoảnh khắc',
    notify_interactions: 'Tương tác',
    notify_interactions_desc: 'Thông báo khi có lượt thích và bình luận',

    // Accessibility
    high_contrast: 'Độ tương phản cao',
    high_contrast_desc: 'Tăng độ rõ nét của chữ và biểu tượng',
    reduce_motion: 'Giảm hiệu ứng chuyển động',
    reduce_motion_desc: 'Tối ưu tốc độ tải và giảm hoạt cảnh',
    large_text: 'Chữ lớn',
    large_text_desc: 'Tăng cỡ chữ toàn ứng dụng lên 20%',

    // Language
    lang_vi: 'Tiếng Việt',
    lang_en: 'English',
    lang_current: 'Ngôn ngữ hiện tại',

    // Auth (Login / Register / Forgot Password)
    welcome_back: 'Chào mừng trở lại',
    login_to_continue: 'Đăng nhập để tiếp tục',
    login_btn: 'Đăng nhập',
    register_btn: 'Tạo tài khoản',
    remember_me: 'Lưu tài khoản',
    forgot_password: 'Quên mật khẩu?',
    forgot_password_desc: 'Điền địa chỉ Gmail của tài khoản. Admin sẽ kiểm tra và gửi mã cho bạn.',
    send_request: 'Gửi yêu cầu cấp mã',
    back_to_login: 'Quay lại đăng nhập',
    no_account: 'Chưa có tài khoản?',
    already_have_account: 'Đã có tài khoản?',
    register_now: 'Đăng ký ngay',
    join_community: 'Tham gia cộng đồng ngay hôm nay',
    display_name: 'Tên hiển thị (tùy chọn)',
    username_label: 'Tên người dùng',
    email_label: 'Địa chỉ Email',
    password_label: 'Mật khẩu',
    confirm_password_label: 'Xác nhận mật khẩu',
    enter_username: 'Vui lòng nhập username',
    username_min_length: 'Username phải có ít nhất 3 ký tự',
    username_invalid_chars: 'Username chỉ chứa chữ, số, dấu _',
    enter_email: 'Vui lòng nhập email',
    invalid_email: 'Email không hợp lệ',
    enter_password: 'Vui lòng nhập mật khẩu',
    password_min_length: 'Mật khẩu phải có ít nhất 6 ký tự',
    password_mismatch: 'Mật khẩu xác nhận không khớp',
    register_failed: 'Đăng ký thất bại. Vui lòng thử lại.',
    login_failed: 'Đăng nhập thất bại. Vui lòng thử lại.',
    enter_gmail: 'Vui lòng nhập địa chỉ Gmail',
    invalid_gmail: 'Địa chỉ Gmail không hợp lệ',
    forgot_password_success: 'Đã lưu lại thông tin, admin sẽ gửi mã cho bạn!',
    gmail_not_found: 'Gmail đó không có trong hệ thống.',

    // Modals
    ota_title: 'Cập nhật OTA',
    ota_subtitle: 'Hệ thống cập nhật phần mềm không dây Over-The-Air',
    ota_channel: 'Kênh cập nhật',
    ota_channel_prod: 'Chính thức (Production)',
    ota_channel_beta: 'Thử nghiệm (Beta)',
    ota_check_now: 'Kiểm tra cập nhật OTA',
    ota_checking: 'Đang kiểm tra cập nhật...',
    ota_up_to_date: 'Ứng dụng của bạn đang ở phiên bản mới nhất!',
    ota_update_available: 'Có bản cập nhật OTA mới!',
    ota_download_now: 'Tải xuống & Cập nhật OTA ngay',
    ota_downloading: 'Đang tải gói cập nhật OTA...',
    ota_download_complete: 'Đã tải xong gói cập nhật!',
    ota_restart_apply: 'Khởi động lại ngay để áp dụng',
    ota_restart_later: 'Để sau',
    ota_auto_check: 'Tự động kiểm tra OTA khi mở ứng dụng',
    ota_changelog: 'Nội dung cập nhật',
    ota_bundle_size: 'Dung lượng',
    ota_release_date: 'Ngày phát hành',
    ota_current_ver: 'Phiên bản hiện tại',
    ota_new_ver: 'Phiên bản mới',
    ota_test_simulate_new: '🧪 Thử nghiệm: Giả lập có bản mới',
    ota_test_simulate_uptodate: '🧪 Thử nghiệm: Giả lập đã mới nhất',
    ota_applied_success: 'Đã cập nhật OTA thành công!',
    create_group_title: 'Tạo nhóm trò chuyện',
    group_name_placeholder: 'Đặt tên nhóm...',
    select_members: 'Chọn thành viên tham gia',
    min_members_hint: 'Cần chọn ít nhất 1 thành viên',
    file_viewer: 'Trình xem tệp tin',
    reading_file: 'Đang đọc tệp tin...',
    copy_content: 'Sao chép',
    copied_content: 'Đã chép',
    download: 'Tải về',
    lines_count: 'dòng',

    // Feed extra
    all_posts: 'Tất cả',
    friends_posts: 'Bài viết bạn bè',
    explore_public: 'Khám phá (Toàn MXH)',
    interactions: 'lượt tương tác',
    comments_count: 'bình luận',
    clear_search: 'Xóa từ khóa',
    clear_filter: 'Bỏ lọc',
    no_posts_found: 'Không tìm thấy bài viết',
    no_posts_match: 'Không có bài viết nào khớp với từ khóa',
    share_moment_now: 'Chia sẻ khoảnh khắc ngay',
    moment_tag: '+ Khoảnh khắc',
    in_scope: 'trong phạm vi',
    search_friends_scope: 'bạn bè',
    search_public_scope: 'khám phá công khai',
    search_public_explore: 'Tìm kiếm trong Khám phá công khai',
    welcome_chat_title: 'Chào mừng đến nhóm chat!',
    welcome_chat_desc: 'Gửi lời chào đầu tiên tới tất cả các thành viên nào.',
    typing_status: 'đang soạn tin... ✍️',
    typing_user_suffix: 'đang soạn tin... ✍️',
    search_in_chat: 'Tìm tin nhắn hoặc tệp tin...',
    search_in_group: 'Tìm tin nhắn hoặc tệp tin trong nhóm...',
    zero_results: '0 kết quả',
    zoom_hint: 'Chạm phóng to',
    attach_note_placeholder: 'Thêm ghi chú cho tệp tin...',

    // Friends extra
    friends_count: 'Bạn bè',
    suggestions_count: 'Gợi ý kết bạn',
    requests_count: 'Lời mời',
    no_suggestions_desc: 'Hiện tại không có đề xuất nào mới. Bạn có thể sử dụng thanh tìm kiếm phía trên để tìm bạn bè!',
    no_requests_desc: 'Các lời mời kết bạn mới gửi đến bạn sẽ hiển thị tại đây.',
    see_suggestions: 'Xem gợi ý kết bạn',
    search_friends_input: 'Tìm bạn bè hoặc tìm kết bạn mới...',
    your_friends_section: 'Bạn bè của bạn',
    find_friends_section: 'Tìm kết bạn mới',
    no_results_for_query: 'Không tìm thấy kết quả',
    no_users_match: 'Không có người bạn hoặc người dùng nào khớp với',

    // Messages extra
    chat_title: 'Trò chuyện 💬',
    create_group_btn: '👥＋ Tạo nhóm',
    direct_1_1: 'Cá nhân (1-1) 💬',
    group_chat_section: 'Nhóm trò chuyện 👥',
    pin_to_top: 'Ghim lên đầu danh sách',
    unpin_conversation: 'Bỏ ghim cuộc trò chuyện',
    open_conversation: 'Mở cuộc trò chuyện',
    start_chat_hint: 'Chọn bạn bè ở trên để bắt đầu trò chuyện nhé!',
    start_group_hint: 'Bấm nút "Tạo nhóm" ở trên để tạo phòng chat chung với bạn bè!',
    no_chat_yet: 'Chưa có cuộc trò chuyện nào',
    no_chat_desc: 'Bắt đầu trò chuyện với bạn bè hoặc tạo nhóm mới ngay!',
    all_tab: 'Tất cả',
    direct_tab: 'Cá nhân',
    groups_tab: 'Nhóm',

    // Chat / Group Chat extra
    chat_settings: 'Cài đặt cuộc trò chuyện',
    search_messages_desc: 'Tìm nhanh nội dung và tệp tin trong đoạn chat',
    pin_chat_desc: 'Đưa cuộc trò chuyện lên vị trí ưu tiên',
    pinned_chat_desc: 'Đang ghim lên đầu danh sách tin nhắn',
    mute_chat_desc: 'Nhận thông báo khi có tin nhắn mới',
    muted_chat_desc: 'Đang tắt thông báo (Im lặng)',
    theme_chat_desc: 'Đổi hình nền nghệ thuật hoặc ảnh cá nhân',
    custom_theme_desc: 'Đang dùng hình nền tùy chỉnh',
    unpinned_status: 'Chưa ghim',
    enabled_status: 'Đang bật 🔔',
    add_friends_to_group: 'Thêm bạn bè vào nhóm',
    all_friends_in_group: 'Tất cả bạn bè đã có trong nhóm!',
    add_selected_friends: 'Thêm bạn bè',
    change_group_avatar: 'Đổi ảnh đại diện nhóm 👥',
    take_new_photo_camera: 'Chụp ảnh mới bằng máy ảnh',
    choose_photo_library: 'Chọn ảnh từ thư viện / thư mục',

    // Add photo extra
    share_photo: 'Chia sẻ',
    change_photo: 'Chọn ảnh khác',
    retake_photo: 'Chụp lại',
    take_new_photo: 'Chụp ảnh mới',
    take_new_photo_desc: 'Mở máy ảnh chụp khoảnh khắc trực tiếp',
    choose_from_library: 'Chọn từ thư viện',
    choose_from_library_desc: 'Tải bức ảnh có sẵn từ bộ nhớ máy',
    caption_label: 'Lời nhắn / Caption',
    caption_placeholder: 'Viết lời nhắn cho khoảnh khắc này...',
    post_privacy: 'Quyền riêng tư bài viết',
    public_desc: 'Ai trên Masita cũng có thể xem và khám phá bài viết này.',
    friends_desc: 'Chỉ bạn bè đã kết bạn mới có thể xem bài viết này.',
    private_desc: 'Chỉ mình bạn mới có thể xem bài viết này (ẩn với tất cả).',
    privacy_public_desc: 'Ai trên Masita cũng có thể xem và khám phá bài viết này.',
    privacy_friends_desc: 'Chỉ bạn bè đã kết bạn mới có thể xem bài viết này.',
    privacy_private_desc: 'Chỉ mình bạn mới có thể xem bài viết này (ẩn với tất cả).',
    send_private_to_friends: 'Gửi riêng tới bạn bè (Tùy chọn)',
    send_to_friends_label: 'Gửi riêng tới bạn bè (Tùy chọn)',
    all_friends: 'Tất cả bạn bè',
    add_moment_title: 'Thêm khoảnh khắc',
    add_moment_sub: 'Chia sẻ khoảnh khắc thú vị với ảnh hoặc video',
    record_new_video: 'Quay video mới',
    record_video_desc: 'Ghi lại video ngắn lên tới 60 giây',
    choose_media_library: 'Chọn ảnh / video từ thư viện',
    choose_media_library_desc: 'Chọn từ bộ sưu tập trên thiết bị',
    retake_video: 'Quay lại video',
    change_file: 'Đổi tệp tin',
    change_other_file: 'Đổi tệp khác',
    tap_to_preview_video: 'Chạm để xem trước video',
    preview_video: 'Xem trước video',
    post_video_success: 'Đăng video khoảnh khắc thành công! 🎬',
    upload_video_failed: 'Không thể tải video lên.',

    // Share modal extra
    share_moment: 'Chia sẻ khoảnh khắc 📤',
    save_to_device: 'Lưu ảnh về máy',
    save_to_device_desc: 'Tải và lưu ảnh vào bộ sưu tập thiết bị',
    copy_link: 'Sao chép đường link',
    copy_link_desc: 'Lấy liên kết bài viết để gửi bạn bè',
    share_other_apps: 'Chia sẻ qua ứng dụng khác',
    share_other_apps_desc: 'Gửi qua Zalo, Messenger, Telegram...',

    // Post Options extra
    edit_post_desc: 'Thay đổi chú thích, mô tả khoảnh khắc',
    delete_post_desc: 'Gỡ bức ảnh khoảnh khắc này khỏi bảng tin',

    // Create Group extra
    create_group_hint: 'Chạm để chọn hoặc chụp ảnh nhóm',
    group_name_label: 'Tên nhóm trò chuyện',
    search_friends_add: 'Tìm bạn bè để thêm vào nhóm...',
    selected_friends: 'Đã chọn',
    no_friends_to_add: 'Chưa có bạn bè để thêm',
    create_group_action: 'Tạo nhóm ✨',

    // File viewer extra
    copy_text: 'Chép',
    copied_text: 'Đã chép',
    download_text: 'Tải',
    download_to_open: 'Tải tệp về thiết bị để mở',

    // Common
    save: 'Lưu',
    cancel: 'Hủy',
    confirm: 'Xác nhận',
    close: 'Đóng',
    edit: 'Chỉnh sửa',
    delete: 'Xóa',
    logout: 'Đăng xuất',
    logout_confirm_msg: 'Bạn có chắc chắn muốn đăng xuất tài khoản?',
    search_users_desc: 'Nhập tên người dùng hoặc email để kết nối bạn bè mới.',
    friends_badge: 'Bạn bè',
    chat_btn: 'Nhắn',
    email_field: 'Email',
    username_field: 'Tên người dùng',
    delete_comment_title: 'Xóa bình luận',
    delete_comment_confirm: 'Bạn có chắc muốn xóa bình luận này?',
    just_now: 'Vừa xong',
    reply_to_tag: 'Trả lời',
    minutes_ago: 'phút trước',
    hours_ago: 'giờ trước',
    days_ago: 'ngày trước',
    login_success: 'Đăng nhập thành công!',
    register_success: 'Đăng ký tài khoản thành công!',
    post_success: 'Đã đăng ảnh khoảnh khắc thành công! 📸',
    delete_comment_success: 'Đã xóa bình luận.',
    delete_comment_error: 'Xóa bình luận thất bại.',
    send_comment_error: 'Gửi bình luận thất bại.',
    load_comments_error: 'Không thể tải danh sách bình luận.',
    react_comment_error: 'Không thể thả cảm xúc.',
    on: 'Bật',
    off: 'Tắt',
    search: 'Tìm kiếm',
    loading: 'Đang tải...',
    retry: 'Thử lại',
    select_photo_first: 'Vui lòng chọn hoặc chụp 1 bức ảnh trước.',
    camera_error: 'Không thể mở máy ảnh. Vui lòng thử lại.',
    upload_photo_failed: 'Đăng ảnh thất bại.',
    success: 'Thành công',
    error: 'Đã xảy ra lỗi',
  },
  en: {
    // Navigation tabs
    home: 'Home',
    friends: 'Friends',
    messages: 'Messages',
    profile: 'Profile',

    // Feed & Posts
    feed_title: 'Explore',
    feed_all: 'All',
    feed_friends: 'Friends',
    feed_search_placeholder: 'Search posts, captions...',
    feed_empty: 'No posts yet',
    feed_empty_desc: 'Be the first to share a moment!',
    create_post: 'New Post',
    new_moment: 'New Moment',
    like: 'Like',
    liked: 'Liked',
    comment: 'Comment',
    comments: 'Comments',
    share: 'Share',
    post_options: 'Post Options',
    save_post: 'Save Post',
    save_post_desc: 'Save to your collection on profile',
    unsave_post: 'Remove Post',
    unsave_post_desc: 'Remove from your saved collection',
    repost_post: 'Repost',
    repost_post_desc: 'Share this post to your profile',
    unrepost_post: 'Undo Repost',
    unrepost_post_desc: 'Remove this post from your reposts',
    edit_post: 'Edit Post',
    delete_post: 'Delete Post',
    confirm_delete_post: 'Are you sure you want to delete this post?',
    public: 'Public',
    friends_only: 'Friends',
    private: 'Only Me',
    write_caption: 'Write a caption...',
    who_can_see: 'Who can see this moment?',
    post_now: 'Post Now',

    // Comments Modal
    comments_title: 'Comments',
    comments_empty: 'No comments yet. Be the first to comment!',
    write_comment: 'Write a comment...',
    reply: 'Reply',
    replying_to: 'Replying to',
    cancel_reply: 'Cancel',
    send: 'Send',
    pin_comment: 'Pin comment',
    unpin_comment: 'Unpin comment',
    delete_comment: 'Delete comment',

    // Friends Screen
    friends_title: 'Friends',
    tab_my_friends: 'Friends',
    tab_suggestions: 'Suggestions',
    tab_requests: 'Requests',
    search_friends_placeholder: 'Search friends...',
    add_friend: 'Add Friend',
    request_sent: 'Request Sent',
    cancel_request: 'Cancel Request',
    accept: 'Accept',
    decline: 'Decline',
    unfriend: 'Unfriend',
    no_friends: 'No friends yet',
    no_suggestions: 'No suggestions available',
    no_requests: 'No friend requests',
    search_users: 'Search Users',
    search_users_placeholder: 'Enter name, username or email...',

    // Messages Screen
    messages_title: 'Messages',
    tab_direct: 'Direct',
    tab_groups: 'Groups',
    search_messages_placeholder: 'Search conversations...',
    create_group: 'Create Group',
    no_conversations: 'No conversations yet',
    no_groups: 'No groups yet',
    pinned: 'Pinned',
    muted: 'Muted',

    // Chat & Group Chat
    type_message: 'Type a message...',
    type_group_message: 'Type a group message...',
    online: 'Active now',
    offline: 'Offline',
    members: 'members',
    group_info: 'Group Info',
    search_chat: 'Search',
    pin_chat: 'Pin Chat',
    pin_group: 'Pin Group',
    unpin_chat: 'Unpin Chat',
    mute_notifications: 'Mute Notifications',
    unmute_notifications: 'Unmute Notifications',
    muted_status: 'Muted',
    unmuted_status: 'Unmuted',
    theme_and_wallpaper: 'Theme & Wallpaper',
    chat_theme: 'Theme & Wallpaper',
    take_photo: 'Camera',
    photo_library: 'Gallery',
    choose_file: 'Choose File',
    remove_wallpaper: 'Remove Wallpaper',
    featured_wallpapers: 'Featured Wallpapers:',
    trending_wallpapers: 'Trending Wallpapers:',
    member_list: 'Member List',
    add_member: '＋ Add',
    group_admin: '👑 Admin',
    group_member: 'Member',
    remove_member: 'Remove',
    leave_group: '🚪 Leave Group',
    confirm_leave_group: 'Are you sure you want to leave this group?',
    readable_file: '📖 Readable',
    download_file: 'Download File',
    updating_wallpaper: 'Updating wallpaper...',

    // Profile Screen
    posts_stat: 'Posts',
    friends_stat: 'Friends',
    likes_stat: 'Likes',
    edit_profile: 'Edit Profile',
    bio_placeholder: 'No bio yet',
    my_posts: 'Posts',
    saved_posts: 'Saved',

    // Settings
    settings: 'Settings',
    account: 'Account',
    privacy: 'Privacy',
    security: 'Security & Login',
    share_profile: 'Share Profile',
    display: 'Display Settings',
    notifications: 'Notifications',
    appearance: 'Appearance',
    language: 'Language',
    accessibility: 'Accessibility',
    support: 'Support & About',
    help_center: 'Help Center',
    privacy_center: 'Privacy Center',
    terms: 'Terms & Policies',
    version: 'App Version',

    // Settings Sub-pages
    account_settings: 'Account Settings',
    edit_account: 'Edit Account',
    change_username: 'Change Username',
    change_email: 'Change Email Address',
    change_password: 'Change Password',
    current_username: 'Current Username',
    new_username: 'New Username',
    current_email: 'Current Email',
    new_email: 'New Email',
    current_password: 'Current Password',
    new_password: 'New Password',
    confirm_new_password: 'Confirm New Password',
    privacy_settings: 'Privacy Settings',
    private_account: 'Private Account',
    private_account_desc: 'Only friends can view your posts and moments',
    public_account_desc: 'Everyone can view your public posts and moments',
    suggest_account: 'Suggest Account',
    suggest_account_desc: 'Allow suggesting your account to other people',
    stranger_find_you: 'People can find you by',
    find_by_name: 'Find by Display Name',
    find_by_username: 'Find by Username',
    find_by_email: 'Find by Email',
    security_settings: 'Security & Login',
    two_factor: 'Two-Factor Auth (2FA)',
    two_factor_desc: 'Protect account with verification codes sent to email',
    active_sessions: 'Active Login Sessions',
    logout_other_devices: 'Log out of all other devices',

    // Theme
    dark_mode: 'Dark Mode',
    light_mode: 'Light Mode',
    theme_dark: 'Dark Interface (Dark Mode)',
    theme_light: 'Light Interface (Light Mode)',

    // Notifications Settings
    notify_messages: 'New Messages',
    notify_messages_desc: 'Get notified when you receive new messages',
    notify_posts: 'New Posts',
    notify_posts_desc: 'Get notified when friends share moments',
    notify_interactions: 'Interactions',
    notify_interactions_desc: 'Get notified for likes and comments',

    // Accessibility
    high_contrast: 'High Contrast',
    high_contrast_desc: 'Increase clarity of text and icons',
    reduce_motion: 'Reduce Motion',
    reduce_motion_desc: 'Reduce animations for better performance',
    large_text: 'Large Text',
    large_text_desc: 'Increase app-wide font size by 20%',

    // Language
    lang_vi: 'Tiếng Việt',
    lang_en: 'English',
    lang_current: 'Current Language',

    // Auth (Login / Register / Forgot Password)
    welcome_back: 'Welcome Back',
    login_to_continue: 'Sign in to continue',
    login_btn: 'Sign In',
    register_btn: 'Create Account',
    remember_me: 'Remember Me',
    forgot_password: 'Forgot Password?',
    forgot_password_desc: 'Enter your Gmail address. Admin will review and provide a reset code.',
    send_request: 'Send Request',
    back_to_login: 'Back to Sign In',
    no_account: "Don't have an account?",
    already_have_account: 'Already have an account?',
    register_now: 'Sign Up Now',
    join_community: 'Join our community today',
    display_name: 'Display Name (optional)',
    username_label: 'Username',
    email_label: 'Email Address',
    password_label: 'Password',
    confirm_password_label: 'Confirm Password',
    enter_username: 'Please enter a username',
    username_min_length: 'Username must be at least 3 characters',
    username_invalid_chars: 'Username can only contain letters, numbers, and _',
    enter_email: 'Please enter your email',
    invalid_email: 'Invalid email address',
    enter_password: 'Please enter your password',
    password_min_length: 'Password must be at least 6 characters',
    password_mismatch: 'Passwords do not match',
    register_failed: 'Registration failed. Please try again.',
    login_failed: 'Login failed. Please try again.',
    enter_gmail: 'Please enter your Gmail address',
    invalid_gmail: 'Invalid Gmail address',
    forgot_password_success: 'Request recorded, admin will send you a code!',
    gmail_not_found: 'That Gmail was not found in the system.',

    // Modals
    ota_title: 'OTA Updates',
    ota_subtitle: 'Over-The-Air wireless application update engine',
    ota_channel: 'Update Channel',
    ota_channel_prod: 'Production',
    ota_channel_beta: 'Beta Channel',
    ota_check_now: 'Check for OTA Updates',
    ota_checking: 'Checking for updates...',
    ota_up_to_date: 'Your app is up to date!',
    ota_update_available: 'New OTA update available!',
    ota_download_now: 'Download & Install OTA Now',
    ota_downloading: 'Downloading OTA update...',
    ota_download_complete: 'Update bundle downloaded!',
    ota_restart_apply: 'Restart App to Apply',
    ota_restart_later: 'Later',
    ota_auto_check: 'Auto-check for updates on launch',
    ota_changelog: 'What’s New',
    ota_bundle_size: 'Bundle Size',
    ota_release_date: 'Release Date',
    ota_current_ver: 'Current Version',
    ota_new_ver: 'New Version',
    ota_test_simulate_new: '🧪 Test: Simulate new update',
    ota_test_simulate_uptodate: '🧪 Test: Simulate up-to-date',
    ota_applied_success: 'OTA update applied successfully!',
    create_group_title: 'Create Group Chat',
    group_name_placeholder: 'Group name...',
    select_members: 'Select Members',
    min_members_hint: 'Select at least 1 member',
    file_viewer: 'File Viewer',
    reading_file: 'Reading file...',
    copy_content: 'Copy',
    copied_content: 'Copied',
    download: 'Download',
    lines_count: 'lines',

    // Feed extra
    all_posts: 'All',
    friends_posts: 'Friends Posts',
    explore_public: 'Explore (Public)',
    interactions: 'interactions',
    comments_count: 'comments',
    clear_search: 'Clear query',
    clear_filter: 'Clear filter',
    no_posts_found: 'No posts found',
    no_posts_match: 'No posts match the query',
    share_moment_now: 'Share moment now',
    moment_tag: '+ Moment',
    in_scope: 'in scope',
    search_friends_scope: 'friends',
    search_public_scope: 'public explore',
    search_public_explore: 'Search in Public Explore',
    welcome_chat_title: 'Welcome to group chat!',
    welcome_chat_desc: 'Say hello to all group members.',
    typing_status: 'is typing... ✍️',
    typing_user_suffix: 'is typing... ✍️',
    search_in_chat: 'Search messages or files...',
    search_in_group: 'Search messages or files in group...',
    zero_results: '0 results',
    zoom_hint: 'Tap to zoom',
    attach_note_placeholder: 'Add a note to file...',

    // Friends extra
    friends_count: 'Friends',
    suggestions_count: 'Suggestions',
    requests_count: 'Requests',
    no_suggestions_desc: 'No new suggestions right now. You can use the search bar above to find friends!',
    no_requests_desc: 'New friend requests will appear here.',
    see_suggestions: 'View suggestions',
    search_friends_input: 'Search friends or find new users...',
    your_friends_section: 'Your Friends',
    find_friends_section: 'Find New Friends',
    no_results_for_query: 'No results found',
    no_users_match: 'No users or friends match',

    // Messages extra
    chat_title: 'Chats 💬',
    create_group_btn: '👥＋ New Group',
    direct_1_1: 'Direct (1-1) 💬',
    group_chat_section: 'Group Chats 👥',
    pin_to_top: 'Pin to top',
    unpin_conversation: 'Unpin conversation',
    open_conversation: 'Open conversation',
    start_chat_hint: 'Select a friend above to start chatting!',
    start_group_hint: 'Tap "New Group" above to create a shared chat with friends!',
    no_chat_yet: 'No conversations yet',
    no_chat_desc: 'Start chatting with friends or create a new group now!',
    all_tab: 'All',
    direct_tab: 'Direct',
    groups_tab: 'Groups',

    // Chat / Group Chat extra
    chat_settings: 'Chat Settings',
    search_messages_desc: 'Search messages and files in chat',
    pin_chat_desc: 'Prioritize this conversation at the top',
    pinned_chat_desc: 'Pinned at top of message list',
    mute_chat_desc: 'Receive alerts for new messages',
    muted_chat_desc: 'Notifications muted (Silent)',
    theme_chat_desc: 'Custom wallpaper or themes',
    custom_theme_desc: 'Using custom wallpaper',
    unpinned_status: 'Unpinned',
    enabled_status: 'Enabled 🔔',
    add_friends_to_group: 'Add friends to group',
    all_friends_in_group: 'All friends are already in this group!',
    add_selected_friends: 'Add friends',
    change_group_avatar: 'Change Group Avatar 👥',
    take_new_photo_camera: 'Take new photo with camera',
    choose_photo_library: 'Choose photo from library / files',

    // Add photo extra
    share_photo: 'Share',
    change_photo: 'Change photo',
    retake_photo: 'Retake',
    take_new_photo: 'Take new photo',
    take_new_photo_desc: 'Open camera to capture moment directly',
    choose_from_library: 'Choose from library',
    choose_from_library_desc: 'Upload an existing photo from device storage',
    caption_label: 'Caption / Message',
    caption_placeholder: 'Write a caption for this moment...',
    post_privacy: 'Post Privacy',
    public_desc: 'Anyone on Masita can view and explore this post.',
    friends_desc: 'Only confirmed friends can view this post.',
    private_desc: 'Only you can view this post (hidden from everyone).',
    privacy_public_desc: 'Anyone on Masita can view and explore this post.',
    privacy_friends_desc: 'Only confirmed friends can view this post.',
    privacy_private_desc: 'Only you can view this post (hidden from everyone).',
    send_private_to_friends: 'Send privately to friends (Optional)',
    send_to_friends_label: 'Send privately to friends (Optional)',
    all_friends: 'All friends',
    add_moment_title: 'Add Moment',
    add_moment_sub: 'Share interesting moments with photo or video',
    record_new_video: 'Record new video',
    record_video_desc: 'Record a short video up to 60 seconds',
    choose_media_library: 'Choose photo / video from library',
    choose_media_library_desc: 'Choose from your device gallery',
    retake_video: 'Retake video',
    change_file: 'Change file',
    change_other_file: 'Change another file',
    tap_to_preview_video: 'Tap to preview video',
    preview_video: 'Preview video',
    post_video_success: 'Video moment posted successfully! 🎬',
    upload_video_failed: 'Failed to upload video.',

    // Share modal extra
    share_moment: 'Share Moment 📤',
    save_to_device: 'Save photo to device',
    save_to_device_desc: 'Download and save photo to your device gallery',
    copy_link: 'Copy link',
    copy_link_desc: 'Get post link to share with friends',
    share_other_apps: 'Share to other apps',
    share_other_apps_desc: 'Send via Zalo, Messenger, Telegram...',

    // Post Options extra
    edit_post_desc: 'Change caption or moment description',
    delete_post_desc: 'Remove this moment photo from feed',

    // Create Group extra
    create_group_hint: 'Tap to choose or capture group avatar',
    group_name_label: 'Group chat name',
    search_friends_add: 'Search friends to add to group...',
    selected_friends: 'Selected',
    no_friends_to_add: 'No friends to add',
    create_group_action: 'Create Group ✨',

    // File viewer extra
    copy_text: 'Copy',
    copied_text: 'Copied',
    download_text: 'Download',
    download_to_open: 'Download file to device to open',

    // Common
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    close: 'Close',
    edit: 'Edit',
    delete: 'Delete',
    logout: 'Log Out',
    logout_confirm_msg: 'Are you sure you want to log out?',
    search_users_desc: 'Enter username or email to connect with new friends.',
    friends_badge: 'Friends',
    chat_btn: 'Chat',
    email_field: 'Email',
    username_field: 'Username',
    delete_comment_title: 'Delete comment',
    delete_comment_confirm: 'Are you sure you want to delete this comment?',
    just_now: 'Just now',
    reply_to_tag: 'Replying to',
    minutes_ago: 'm ago',
    hours_ago: 'h ago',
    days_ago: 'd ago',
    login_success: 'Login successful!',
    register_success: 'Account registered successfully!',
    post_success: 'Moment posted successfully! 📸',
    delete_comment_success: 'Comment deleted.',
    delete_comment_error: 'Failed to delete comment.',
    send_comment_error: 'Failed to post comment.',
    load_comments_error: 'Failed to load comments.',
    react_comment_error: 'Failed to react to comment.',
    on: 'On',
    off: 'Off',
    search: 'Search',
    loading: 'Loading...',
    retry: 'Retry',
    select_photo_first: 'Please select or take a photo first.',
    camera_error: 'Could not open camera. Please try again.',
    upload_photo_failed: 'Failed to upload photo.',
    success: 'Success',
    error: 'An error occurred',
  },
} as const;

export type TranslationKey = keyof typeof translations.vi;

/**
 * Định dạng thời gian tương đối đa ngôn ngữ (vd: "Vừa xong" / "Just now", "22h trước" / "22h ago", "15p" / "15m")
 */
export const formatRelativeTime = (
  dateStrOrDate?: string | Date | null,
  lang: AppLanguage = 'vi',
  shortForm: boolean = false
): string => {
  if (!dateStrOrDate) return '';
  try {
    const date = typeof dateStrOrDate === 'string' ? new Date(dateStrOrDate) : dateStrOrDate;
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return lang === 'vi' ? 'Vừa xong' : 'Just now';
    }
    if (diffMins < 60) {
      if (lang === 'vi') return shortForm ? `${diffMins}p` : `${diffMins}p trước`;
      return shortForm ? `${diffMins}m` : `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      if (lang === 'vi') return shortForm ? `${diffHours}h` : `${diffHours}h trước`;
      return shortForm ? `${diffHours}h` : `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      if (lang === 'vi') return shortForm ? `${diffDays}d` : `${diffDays} ngày trước`;
      return shortForm ? `${diffDays}d` : `${diffDays}d ago`;
    }
    return date.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return '';
  }
};

/**
 * Hook để lấy hàm dịch t() và định dạng thời gian dựa trên ngôn ngữ hiện tại
 * Ví dụ: const { t, formatTime } = useI18n();
 */
export const useI18n = () => {
  const language = useAppSettings((s) => s.language);

  const t = (key: TranslationKey | string): string => {
    return (translations[language] as any)?.[key] ?? (translations.vi as any)?.[key] ?? key;
  };

  const formatTime = (dateStrOrDate?: string | Date | null, shortForm: boolean = false): string => {
    return formatRelativeTime(dateStrOrDate, language, shortForm);
  };

  const formatClockTime = (dateStrOrDate?: string | Date | null): string => {
    if (!dateStrOrDate) return '';
    try {
      const d = typeof dateStrOrDate === 'string' ? new Date(dateStrOrDate) : dateStrOrDate;
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDateTime = (dateStrOrDate?: string | Date | null, options?: Intl.DateTimeFormatOptions): string => {
    if (!dateStrOrDate) return '';
    try {
      const d = typeof dateStrOrDate === 'string' ? new Date(dateStrOrDate) : dateStrOrDate;
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', options);
    } catch {
      return '';
    }
  };

  return { t, language, formatTime, formatClockTime, formatDateTime };
};

/**
 * Hàm dịch độc lập (không dùng hook, cho các hàm ngoài component)
 */
export const translate = (key: TranslationKey | string, lang: AppLanguage = 'vi'): string => {
  return (translations[lang] as any)?.[key] ?? (translations.vi as any)?.[key] ?? key;
};
