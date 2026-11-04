/* TripTogether UI translations: Vietnamese is the canonical source language. */
(function(){
'use strict';
const dictionary={
  "Đăng nhập / Tạo tài khoản": "Sign in / Sign up",
  "Tài khoản": "Account",
  "Đăng nhập": "Sign in",
  "Tạo tài khoản": "Create account",
  "Đăng xuất khỏi thiết bị": "Sign out on this device",
  "Tài khoản TripTogether": "TripTogether account",
  "Quản lý tài khoản": "Manage account",
  "Xác minh email": "Verify your email",
  "Email đã xác minh": "Email verified",
  "Đang chờ xác minh email": "Awaiting email verification",
  "Mật khẩu": "Password",
  "Mật khẩu mới": "New password",
  "Xác nhận mật khẩu": "Confirm password",
  "Lưu mật khẩu": "Save password",
  "Quên mật khẩu?": "Forgot password?",
  "Tiếp tục với email": "Continue with email",
  "Gửi lại email xác minh": "Resend verification email",
  "Đóng": "Close",
  "Nhập mật khẩu": "Enter password",
  "Nhập lại mật khẩu": "Re-enter password",
  "Ít nhất 8 ký tự": "At least 8 characters",
  "Hiện mật khẩu": "Show password",
  "Ẩn mật khẩu": "Hide password",
  "ĐI CÙNG NHAU, CHI TIU RÕ RÀNG": "TRAVEL TOGETHER, TRACK CLEARLY",
  "ĐI CÙNG NHAU, CHI TIÊU RÕ RÀNG": "TRAVEL TOGETHER, TRACK CLEARLY",
  "Mỗi chuyến đi.": "Every trip.",
  "Một quỹ chung.": "One shared fund.",
  "Ghi chi tiêu, đóng quỹ và đối soát phần mỗi người theo thời gian thực.": "Track expenses, contributions, and settlements in real time.",
  "＋ Tạo chuyến đi": "＋ Create trip",
  "Tạo chuyến đi": "Create trip",
  "Chuyến đi của bạn": "Your trips",
  "Chưa có chuyến đi được lưu trên trình duyệt này. Dán link mời hoặc mã chuyến bên dưới để mở.": "No trips saved on this browser yet. Paste an invitation link or trip code below.",
  "Dán link mời hoặc mã chuyến": "Paste an invite link or trip code",
  "Mở chuyến": "Open trip",
  "CHUYẾN ĐI CHUNG": "SHARED TRIP",
  "Chuyến đi": "Trip",
  "↗ Chia sẻ link xem": "↗ Share view link",
  "Chia sẻ link xem ↗": "Share view link ↗",
  "Bạn đang xem bằng link chia sẻ.": "You're viewing through a shared link.",
  "Link chia sẻ cho phép xem dữ liệu mà không cần mã. Chỉ chia sẻ với người đáng tin cậy. Để chỉnh sửa, hãy đăng nhập bằng tài khoản đang có quyền hoặc tham gia chuyến đi và nhờ chủ chuyến cấp quyền.": "Anyone with the link can view the trip. Share it only with people you trust. To edit, sign in with an authorized account or join the trip and ask the Host for access.",
  "Đăng nhập tài khoản có quyền": "Sign in with an authorized account",
  "Tham gia để xin quyền sửa": "Join to request edit access",
  "TỔNG CHI ĐÃ GHI": "TOTAL EXPENSES",
  "Chi phí được chia đều theo thành viên hiện có": "Expenses are split equally among current members",
  "Quỹ ban đầu": "Initial fund",
  "Đóng quỹ thêm": "Additional contributions",
  "Tổng quỹ": "Total fund",
  "Tiền mặt còn trong quỹ": "Cash remaining in fund",
  "Quỹ còn nợ thành viên": "Fund owes members",
  "Quỹ thực sau khi trừ nợ": "Net fund after debts",
  "Chi tiêu": "Expenses",
  "Đóng quỹ": "Contributions",
  "Thành viên": "Members",
  "Danh sách chi tiêu": "Expense list",
  "Chạm Sửa để cập nhật ngày, hạng mục, người trả, số tiền hoặc ghi chú.": "Tap Edit to change the date, category, payer, amount or notes.",
  "＋ Thêm khoản chi": "＋ Add expense",
  "Theo dõi quỹ": "Fund tracker",
  "Quỹ ban đầu được tính riêng. Các lần đóng thêm nằm trong danh sách dưới đây.": "The initial fund is tracked separately from later contributions.",
  "＋ Đóng quỹ thêm": "＋ Add contribution",
  "Chi tiêu từng thành viên": "Expenses by member",
  "Chênh lệch = quỹ ban đầu chia đều + đóng quỹ − phần chi − quỹ thực chia đều. Khoản ứng chưa hoàn đã trừ vào quỹ thực và được theo dõi riêng, không tính lần hai vào chuyển tiền giữa thành viên.": "Difference = equal share of initial fund + contributions − expenses − equal share of net fund. Unreimbursed advances are tracked separately and not double-counted.",
  "＋ Ghi khoản nợ": "＋ Record debt",
  "＋ Thêm thành viên": "＋ Add member",
  "Đã chi cá nhân": "Paid personally",
  "Đã đóng quỹ": "Contributed",
  "Phần chi": "Expense share",
  "Chênh lệch quỹ": "Fund difference",
  "Xin quyền chỉnh sửa": "Request edit access",
  "Bạn có thể gửi yêu cầu để Host cấp quyền.": "You can ask the Host to grant editing access.",
  "Gửi yêu cầu cấp quyền": "Request access",
  "Yêu cầu quyền chỉnh sửa": "Edit access requests",
  "Chỉ Host có thể duyệt hoặc từ chối. Người xin quyền phải tham gia chuyến đi trước.": "Only the Host can approve or reject. Members must join the trip first.",
  "Quyền chỉnh sửa thành viên": "Member edit permissions",
  "Chọn thành viên được phép thêm, sửa và xóa dữ liệu chuyến đi.": "Choose who may add, edit or delete trip records.",
  "Đối soát quỹ": "Fund settlement",
  "Gợi ý cân bằng khoản đóng quỹ giữa các thành viên. Các khoản quỹ còn nợ thành viên được theo dõi riêng và không tính lần hai vào đối soát này.": "Suggested transfers to balance members' fund contributions. Unreimbursed advances are tracked separately and not counted twice.",
  "Khoản nợ riêng giữa thành viên": "Personal debts between members",
  "Ghi các khoản nợ cá nhân ngoài phần chia chi tiêu chung.": "Record private debts separately from shared trip costs.",
  "Gợi ý trả nợ riêng": "Suggested debt settlements",
  "Các khoản chuyển tối giản theo nợ riêng chưa thanh toán.": "Simplified transfers for unsettled personal debts.",
  "Xóa chuyến đi": "Delete trip",
  "Rời chuyến": "Leave trip",
  "● Đang kết nối…": "● Connecting…",
  "Tên chuyến đi": "Trip name",
  "Ví dụ: Cao Bằng": "Example: Cao Bang",
  "Quỹ ban đầu (VNĐ)": "Initial fund (VND)",
  "Hủy": "Cancel",
  "Tạo chuyến": "Create",
  "Tên hiển thị của bạn": "Your display name",
  "Tên này sẽ xuất hiện trong chuyến đi chung.": "This name will appear in the shared trip.",
  "Tên của bạn": "Your name",
  "Tiếp tục": "Continue",
  "Sửa": "Edit",
  "Thêm khoản chi": "Add expense",
  "Hạng mục / nội dung": "Category / description",
  "Ví dụ: Vé máy bay": "Example: Flight tickets",
  "Số tiền (VNĐ)": "Amount (VND)",
  "Nguồn thanh toán": "Payment source",
  "Lấy từ quỹ chung": "Paid from shared fund",
  "Nếu thành viên ứng tiền, quỹ chỉ giảm khi đánh dấu đã hoàn trả.": "If a member pays upfront, the fund is reduced only when marked reimbursed.",
  "Ngày": "Date",
  "Phân loại": "Category",
  "Ăn uống": "Food",
  "Di chuyển": "Transport",
  "Lưu trú": "Accommodation",
  "Vé tham quan": "Tickets",
  "Mua sắm": "Shopping",
  "Khác": "Other",
  "Ghi chú": "Notes",
  "Thông tin thêm nếu có": "Additional details (optional)",
  "Lưu khoản chi": "Save expense",
  "Người đóng": "Contributor",
  "Ví dụ: Đóng quỹ lần 1": "Example: First contribution",
  "Ngày đóng": "Contribution date",
  "Lưu khoản đóng": "Save contribution",
  "Sửa quỹ ban đầu": "Edit initial fund",
  "Nhập số tiền trong quỹ trước các lần đóng thêm.": "Enter the fund amount before additional contributions.",
  "Lưu quỹ ban đầu": "Save initial fund",
  "Thêm thành viên": "Add member",
  "Thêm người chưa dùng link mời. Người này sẽ được tính vào phần chia đều.": "Add someone who has not used the invite link. They will be included in the equal split.",
  "Tên thành viên": "Member name",
  "Ví dụ: Minh": "Example: Minh",
  "Ghi khoản nợ thành viên": "Record member debt",
  "Khoản này hiển thị trong đối soát thành viên; không trừ vào quỹ chung.": "This debt appears in member settlement and does not reduce the shared fund.",
  "Người nợ": "Debtor",
  "Người nhận nợ": "Creditor",
  "Lý do khoản nợ": "Reason for debt",
  "Lưu khoản nợ": "Save debt",
  "Đã đồng bộ": "Synced",
  "Chỉ xem": "View only",
  "Đang cập nhật…": "Refreshing…",
  "Đang lưu…": "Saving…",
  "Đang tham gia…": "Joining…",
  "Đang gửi yêu cầu…": "Sending request…",
  "Đang xử lý…": "Processing…",
  "Đang xin quyền chỉnh sửa": "Requesting edit permission",
  "Đang chờ Host duyệt yêu cầu.": "Waiting for Host approval.",
  "Duyệt": "Approve",
  "Từ chối": "Reject",
  "Có quyền chỉnh sửa": "Can edit",
  "Cấp quyền sửa": "Grant edit access",
  "Thu hồi quyền": "Revoke access",
  "Thêm khoản chi đầu tiên.": "Add your first expense.",
  "Chưa có khoản chi. Thêm khoản chi đầu tiên.": "No expenses yet. Add the first one.",
  "Chưa có khoản đóng thêm.": "No extra contributions yet.",
  "Chưa có thành viên.": "No members yet.",
  "Chưa ghi khoản nợ nào.": "No debts recorded yet.",
  "Chưa thanh toán": "Unpaid",
  "Đã thanh toán": "Paid",
  "Đánh dấu đã trả": "Mark as paid",
  "Đánh dấu chưa trả": "Mark unpaid",
  "Quỹ đã hoàn trả": "Reimbursed by fund",
  "Xóa": "Delete",
  "Lưu thay đổi": "Save changes",
  "Quỹ đã cân đối theo phần đóng góp.": "The fund is balanced.",
  "Không có khoản nợ chưa thanh toán.": "No outstanding debts.",
  "Chưa có yêu cầu cấp quyền mới.": "No new edit requests.",
  "Bạn hiện chỉ được xem. Gửi yêu cầu để Host cấp quyền sửa.": "You can only view this trip. Ask the Host for editing access.",
  "Yêu cầu trước đã bị từ chối. Bạn có thể gửi lại.": "Your previous request was rejected. You may request again.",
  "Host cần cài trip_edit_requests.sql trên Supabase để bật yêu cầu cấp quyền.": "The Host must enable edit requests in Supabase.",
  "Email": "Email",
  "Kết nối chuyến đi và quyền chỉnh sửa trên các thiết bị của bạn.": "Keep your trips and editing permissions across devices.",
  "Đang dùng tài khoản khách? Liên kết email để giữ nguyên các chuyến đi và quyền Host trên thiết bị này. Sau khi xác minh email, bạn sẽ đặt mật khẩu.": "Using a guest account? Link your email to preserve trips and Host access on this device. You'll set a password after verification.",
  "Đang gửi email…": "Sending email…",
  "Đang đăng nhập…": "Signing in…",
  "Dùng đúng email đã liên kết với chuyến đi để khôi phục quyền Host hoặc quyền chỉnh sửa.": "Use the email linked to your trip to restore Host or edit access.",
  "Dùng cùng email và mật khẩu trên điện thoại hoặc máy tính để quản lý chuyến đi và quyền Host.": "Use the same email and password across devices to manage your trips and Host access.",
  "Mở liên kết xác minh được gửi tới email của bạn, sau đó quay lại TripTogether để tạo mật khẩu.": "Open the verification link in your email, then return to TripTogether to set a password.",
  "Chỉ đăng xuất thiết bị này, không xóa chuyến đi.": "Only this device is signed out; trips are not deleted.",
  "● Chỉ xem · chưa được cấp quyền sửa": "● View only · no edit access",
  "● Chế độ chỉ xem": "● View-only mode",
  "● Đã đồng bộ": "● Synced",
  "● Đang cập nhật…": "● Refreshing…",
  "Bạn cần đăng nhập để tạo chuyến đi.": "Sign in to create a trip.",
  "Đăng nhập hoặc tạo tài khoản để tạo và quản lý chuyến đi.": "Sign in or create an account to create and manage trips.",
  "Đăng nhập / Đăng ký": "Sign in / Sign up",
  "Đăng nhập để tạo chuyến đi": "Sign in to create a trip"
};
Object.assign(dictionary,{"Đã gửi yêu cầu. Host sẽ quyết định cấp quyền chỉnh sửa.":"Request sent. The Host will decide whether to grant editing access.","Đã tham gia chuyến đi. Mở tab Thành viên → Xin quyền chỉnh sửa để gửi yêu cầu cho Host.":"You've joined the trip. Open Members → Request edit access to ask the Host.","Không tìm thấy chuyến đi hoặc link không hợp lệ.":"Trip not found or the link is invalid.","Hãy cấu hình Supabase theo SETUP.md trước nhé.":"Please configure Supabase according to SETUP.md first.","Cần ít nhất hai thành viên để ghi khoản nợ.":"At least two members are required to record a debt.","Người nợ và người nhận nợ phải khác nhau.":"The debtor and creditor must be different people.","Đăng xuất khỏi tài khoản trên thiết bị này? Chuyến đi trên thiết bị khác không bị ảnh hưởng.":"Sign out on this device? Trips on other devices will not be affected.","Đã sao chép link xem (không cần mã). Chỉ chia sẻ với người đáng tin cậy.":"View link copied (no passcode required). Share only with people you trust.","Đã gửi email xác minh.":"Verification email sent.","Đang cập nhật…":"Refreshing…","Xem chuyến đi":"View trip","Đánh dấu đã hoàn trả":"Mark reimbursed","Đánh dấu chưa hoàn trả":"Mark not reimbursed","Chỉ thành viên đã tham gia bằng tài khoản đăng nhập mới hiện ở đây. Thành viên được thêm thủ công chưa có tài khoản nên chưa thể cấp quyền trực tiếp.":"Only members who joined with an account appear here. Manually added members cannot receive direct edit access.","Chưa có thành viên đăng nhập nào để cấp quyền.":"No signed-in members to grant access to yet.","Để bật phân quyền riêng cho từng thành viên, hãy chạy member_edit_permissions.sql một lần trong Supabase SQL Editor. Các thành viên hiện tại vẫn giữ quyền sửa cho đến khi migration được cài.":"Run member_edit_permissions.sql in Supabase SQL Editor once to enable individual permissions. Existing members retain access until migration.","Đang chờ Host duyệt yêu cầu.":"Waiting for Host approval.","Quỹ đã hoàn trả":"Fund reimbursed","Quỹ còn nợ":"Fund owes","Trả trực tiếp từ quỹ":"Paid directly from fund","Ứng bởi":"Advanced by","Chưa có yêu cầu cấp quyền mới.":"No pending access requests.","Đã lưu mật khẩu. Bạn có thể dùng tài khoản này để đăng nhập trên thiết bị khác.":"Password saved. You can now sign in on other devices.","Email hoặc mật khẩu không đúng. Hãy kiểm tra lại hoặc đặt lại mật khẩu.":"Incorrect email or password. Please try again or reset your password.","Email chưa được xác minh. Hãy kiểm tra hộp thư của bạn.":"Email isn't verified yet. Check your inbox.","Email này đã có tài khoản. Hãy chuyển sang Đăng nhập.":"This email already has an account. Switch to Sign in.","Kiểm tra email để xác minh tài khoản. Sau khi xác minh, quay lại đây để tạo mật khẩu.":"Check your email to verify your account, then return to set a password.","Mật khẩu xác nhận chưa khớp.":"Passwords do not match.","Quyền chỉnh sửa":"Edit access","Đang tải…":"Loading…"} );
Object.assign(dictionary,{"Bảo lưu mọi quyền.":"All rights reserved.","Phát triển bởi":"Developed by"});
Object.assign(dictionary,{'Quỹ còn nợ:':'Fund owes:'});
Object.assign(dictionary,{
  "Tìm khoản chi":"Search expenses",
  "Lọc danh mục":"Filter categories",
  "Lọc trạng thái":"Filter status",
  "Tìm theo tên, ghi chú hoặc người trả":"Search name, note, or payer",
  "Tất cả danh mục":"All categories",
  "Tất cả trạng thái":"All statuses",
  "Chưa hoàn trả":"Not reimbursed",
  "Đã hoàn một phần":"Partially reimbursed",
  "Đã thanh toán":"Paid",
  "Không tìm thấy khoản chi phù hợp.":"No matching expenses.",
  "Ghi hoàn trả":"Record reimbursement",
  "Ghi trả nợ":"Record debt payment",
  "Hoàn tác thanh toán":"Reverse payment",
  "Đã hoàn một phần":"Partially reimbursed",
  "Đã trả một phần":"Partially paid",
  "Ghi thanh toán":"Record payment",
  "Số tiền (VNĐ)":"Amount (VND)",
  "Lưu thanh toán":"Save payment",
  "Tùy chọn":"Optional",
  "Lịch sử thanh toán":"Payment history",
  "Các khoản hoàn quỹ và trả nợ, kể cả thanh toán một phần hoặc hoàn tác.":"Reimbursements and debt payments, including partial and reversed payments.",
  "Chưa có thanh toán nào.":"No payments recorded yet.",
  "Nhật ký thay đổi":"Activity history",
  "Xem ai đã cập nhật dữ liệu và khôi phục khoản chi hoặc khoản đóng bị xóa.":"See record edits and restore deleted expenses or contributions.",
  "Chưa có thay đổi nào được ghi nhận.":"No recorded activity yet.",
  "Khôi phục":"Restore",
  "Đã thêm":"Added",
  "Đã sửa":"Edited",
  "Đã xóa":"Deleted",
  "Khoản chi":"Expense",
  "Đóng quỹ":"Contribution",
  "Nợ riêng":"Personal debt",
  "Thanh toán":"Payment",
  "Quỹ chung hoàn tiền":"Fund reimbursement",
  "Thanh toán nợ riêng":"Personal debt payment",
  "Hoàn tác":"Reversed",
  "Đã ghi thanh toán.":"Payment recorded.",
  "Đã khôi phục dữ liệu.":"Record restored.",
  "Không thể khôi phục: ":"Could not restore: ",
  "Không thể ghi thanh toán: ":"Could not record payment: ",
  "Trạng thái không khả dụng":"Status unavailable"
});
Object.assign(dictionary,{
  "Quản lý quyền truy cập":"Manage access",
  "Theo dõi phần chi, đóng quỹ và khoản quỹ còn nợ của mỗi người.":"Track each member's expenses, contributions and outstanding fund reimbursements.",
  "Sửa tên thành viên":"Edit member name",
  "Tên thành viên":"Member name",
  "Lưu thành viên":"Save member",
  "Lưu thay đổi":"Save changes",
  "Thành viên được tính vào phần chia đều của chuyến đi.":"Members are included in the equal expense split.",
  "Cập nhật tên hiển thị. Khoản chi và đóng quỹ hiện có vẫn được giữ nguyên.":"Update the display name without changing existing expenses or contributions.",
  "Không thể lưu thành viên: ":"Unable to save member: ",
  "Không thể xóa thành viên: ":"Unable to remove member: ",
  "Không thể xóa thành viên có giao dịch. Dữ liệu tài chính cần được giữ nguyên.":"A member with transactions cannot be removed. Financial data must be preserved.",
  "Đang xóa…":"Removing…",
  "Đang lưu…":"Saving…",
  "Đang khôi phục…":"Restoring…"
});
Object.assign(dictionary,{
 "KHÔNG GIAN":"WORKSPACE",
 "Tổng quan":"Overview",
 "Khoản chi gần đây":"Recent expenses",
 "Xem tất cả →":"View all →",
 "Xem chi tiết →":"View details →",
 "Tình hình quỹ":"Fund overview",
 "Đóng quỹ →":"Contribute →",
 "Chi tiêu minh bạch hơn khi mọi người cùng theo dõi.":"Clearer expenses when everyone stays informed.",
 "Thêm":"Add",
 "Chưa có khoản chi.":"No expenses yet.",
 "Quỹ còn lại sau khi trừ khoản cần hoàn cho thành viên.":"Fund remaining after outstanding reimbursements.",
 "Cần quyền chỉnh sửa để thêm khoản chi":"Editing permission required to add an expense"
});
Object.assign(dictionary,{
 "Mỗi chuyến đi.":"Every trip.",
 "Thêm niềm vui.":"More joy.",
 "Bớt tính toán. ✨":"Less calculating. ✨",
 "ĐI CÙNG NHAU · CHI TIÊU RÕ RÀNG":"TRAVEL TOGETHER · CLEAR EXPENSES",
 "Theo dõi chi phí, quản lý quỹ chung và chia tiền công bằng — tất cả trong một nơi.":"Track expenses, manage the group fund and split costs fairly — all in one place.",
 "KHÔNG GIAN CỦA TÔI":"MY WORKSPACE",
 "Chuyến đi của bạn ✨":"Your trips ✨",
 "Quản lý chuyến đi và những kỷ niệm của cả nhóm.":"Manage your trips and shared memories.",
 "＋ Tạo chuyến đi mới":"＋ Create new trip",
 "Bắt đầu hành trình tiếp theo của bạn.":"Start your next adventure.",
 "Quản lý chuyến đi":"Manage trip",
 "Chuyến đi đã tham gia":"Joined trip",
 "Xem chuyến đi →":"View trip →",
 "Được mời tham gia chuyến đi?":"Invited to a trip?",
 "Dán liên kết chia sẻ hoặc mã chuyến để mở và xem thông tin.":"Paste a shared link or trip code to open and view it.",
 "Mở chuyến →":"Open trip →",
 "Tạo chuyến đi mới 🚀":"Create a new trip 🚀",
 "Nhập thông tin cơ bản để bắt đầu theo dõi quỹ và chi tiêu.":"Enter the basic details to start tracking your fund and expenses.",
 "Chưa có chuyến đi nào trong tài khoản này. Tạo chuyến đầu tiên hoặc mở liên kết được chia sẻ.":"No trips in this account yet. Create your first trip or open a shared link.",
 "Chủ chuyến đi":"Trip Host",
 "Thành viên":"Members"
});
Object.assign(dictionary,{
  "Đóng quỹ ban đầu (VNĐ)":"Opening contribution (VND)",
  "Không bắt buộc":"Optional",
  "Để trống nếu chưa đóng quỹ. Số tiền sẽ được ghi vào lịch sử Đóng quỹ của thành viên.":"Leave blank if they have not contributed. The amount will appear in the member's contribution history.",
  "Số tiền đóng quỹ phải là số nguyên không âm (VNĐ).":"The contribution must be a non-negative whole amount in VND."
});
Object.assign(dictionary,{
 "Email tài khoản đã được Host mời":"Email invited by the Host",
 "Liên kết với thành viên hiện có":"Link existing member",
 "Email mời (tùy chọn)":"Invitation email (optional)",
 "Host nhập email của thành viên đã có trong danh sách. Email này sẽ được dùng để liên kết tài khoản, không tạo thêm người.":"The Host assigns an email to an existing member. Linking an account will not create another participant.",
 "Email phải trùng với tài khoản đang đăng nhập và đã xác minh.":"Enter the verified email of your signed-in account.",
 "Không thể liên kết thành viên: ":"Could not link existing member: ",
 "Đang liên kết…":"Linking…",
 "Host phải gắn email đã xác minh của bạn với một thành viên có sẵn. Liên kết sẽ không tạo thêm người hay thay đổi số tiền.":"The Host must assign your verified email to an existing member. Linking does not add a person or change finances.",
 "Link chia sẻ chỉ để xem. Đăng nhập bằng email được Host gắn với một thành viên có sẵn để liên kết tài khoản.":"Shared links are view-only. Sign in with an email the Host has assigned to an existing member to link your account."
});
Object.assign(dictionary,{
 "Hợp nhất":"Merge",
 "Hợp nhất thành viên trùng":"Merge duplicate members",
 "Thành viên trùng cần xóa":"Duplicate member to remove",
 "Giữ lại thành viên nào?":"Which member should be kept?",
 "Chọn thành viên cần giữ lại":"Select the member to keep",
 "Hợp nhất thành viên":"Merge members",
 "Tôi xác nhận đây là cùng một người và đồng ý tính lại phần chia của chuyến đi.":"I confirm these two entries represent the same person and agree to recalculate expense shares.",
 "Hợp nhất hai dòng của cùng một người. Khoản chi, đóng quỹ và khoản nợ sẽ chuyển sang thành viên được giữ lại. Số thành viên giảm đi một nên phần chia chi phí sẽ được tính lại.":"Merge two entries for the same person. Their expenses, contributions and debts move to the kept member. The participant count decreases by one, so expense shares will be recalculated.",
 "Không thể hợp nhất Host, hai tài khoản đăng nhập khác nhau, hoặc hai thành viên có khoản nợ riêng giữa họ. Lịch sử thanh toán vẫn được giữ nguyên.":"You cannot merge the Host, two different signed-in accounts, or members with a personal debt between them. Payment history remains preserved.",
 "Không có thành viên phù hợp để hợp nhất.":"There is no eligible member to merge."
});
const reverse=new Map(Object.entries(dictionary).map(([vi,en])=>[en,vi]));
let language=localStorage.getItem('tt_language')==='en'?'en':'vi';
const sourceText=new WeakMap();
const sourceAttributes=new WeakMap();
let scheduled=false;
function translation(original){
 const translated=dictionary[original];
 if(language==='vi')return original;
 if(translated)return translated;
 const variablePrefixes={
  'Quỹ còn nợ: ':'Fund owes: ',
  'Không thể tạo chuyến: ':'Could not create trip: ',
  'Không thể mở chuyến đi: ':'Could not open trip: ',
  'Không thể tham gia chuyến đi: ':'Could not join trip: ',
  'Không thể lưu khoản chi: ':'Could not save expense: ',
  'Không thể lưu khoản đóng quỹ: ':'Could not save contribution: ',
  'Không thể lưu khoản nợ: ':'Could not save debt: ',
  'Không thể cập nhật khoản nợ: ':'Could not update debt: ',
  'Không thể cập nhật hoàn trả: ':'Could not update reimbursement: ',
  'Không thể xử lý yêu cầu: ':'Could not process request: ',
  'Không thể gửi yêu cầu: ':'Could not submit request: ',
  'Không thể kết nối: ':'Connection failed: ',
  'Không thể lưu mật khẩu: ':'Could not save password: ',
  'Không thể gửi email: ':'Could not send email: ',
  'Không thể đăng nhập: ':'Could not sign in: ',
  'Không thể cập nhật quyền sửa: ':'Could not update permissions: '
 };
 for(const [vi,en] of Object.entries(variablePrefixes))if(original.startsWith(vi))return en+original.slice(vi.length);
 // Preserve user-generated names and notes; replace only known UI fragments.
 const m=original.match(/^(\d+) thành viên$/);
 if(m)return m[1]+' members';
 return original;
}
function translateNode(node){
 if(node.nodeType!==Node.TEXT_NODE)return;
 if(node.parentElement?.closest('script,style,textarea,option[data-user-content]'))return;
 const current=node.nodeValue||'';
 let info=sourceText.get(node);
 if(!info||info.rendered!==current){
  const trim=current.trim();
  const canonical=reverse.get(trim)||trim;
  info={original:current,rendered:current,canonical};sourceText.set(node,info);
 }
 const original=info.original;
 const trim=original.trim();
 const canonical=info.canonical;
 const target=translation(canonical);
 const next=trim?original.replace(trim,target):original;
 if(current!==next){info.rendered=next;node.nodeValue=next}
}
function translateAttributes(el){
 for(const attr of ['placeholder','title','aria-label']){
  if(!el.hasAttribute(attr))continue;
  const value=el.getAttribute(attr);
  const stored=sourceAttributes.get(el)||{};
  const prev=stored[attr];
  if(!prev||prev.rendered!==value)stored[attr]={original:reverse.get(value)||value,rendered:value};
  const target=translation(stored[attr].original);
  if(value!==target){stored[attr].rendered=target;el.setAttribute(attr,target)}
  sourceAttributes.set(el,stored);
 }
}
function translateTree(root){
 if(!root)return;
 if(root.nodeType===Node.TEXT_NODE){translateNode(root);return}
 if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE)return;
 if(root.nodeType===Node.ELEMENT_NODE){translateAttributes(root);if(root.tagName==='SCRIPT'||root.tagName==='STYLE')return}
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
 let node;
 while((node=walker.nextNode())){
  if(node.nodeType===Node.TEXT_NODE)translateNode(node);
  else translateAttributes(node);
 }
}
function refresh(){
 document.documentElement.lang=language;
 document.querySelectorAll('[data-language-option]').forEach(button=>{
  const active=button.dataset.languageOption===language;
  button.classList.toggle('active',active);
  button.setAttribute('aria-pressed',String(active));
 });
 translateTree(document.body);
}
function scheduleRefresh(){
 if(scheduled)return;
 scheduled=true;
 queueMicrotask(()=>{scheduled=false;refresh()});
}
window.TripTogetherI18n={
 get language(){return language},
 t(value){return translation(value)},
 setLanguage(next){
  if(next!=='en'&&next!=='vi')return;
  language=next;localStorage.setItem('tt_language',next);refresh()
 },
 refresh
};
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-language-option]');
 if(button)window.TripTogetherI18n.setLanguage(button.dataset.languageOption);
});
const observer=new MutationObserver(scheduleRefresh);
observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
})();
