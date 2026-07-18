export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col-reverse sm:flex-row">
      {/* Left Side - Branding — hidden on small screens, shown on sm+ */}
      <div className="hidden flex-1 flex-col justify-between bg-primary p-8 sm:flex sm:p-12">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 sm:h-12 sm:w-12">
              <svg
                className="h-6 w-6 text-white sm:h-8 sm:w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <span className="text-xl font-bold text-white sm:text-2xl">
              Epath System Training
            </span>
          </div>
          <p className="mt-6 text-base text-white/80 sm:mt-8 sm:text-xl">
            Nền tảng đào tạo nhân viên toàn diện
          </p>
        </div>

        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-4">
            {[
              {
                title: "Quản lý khóa học thông minh",
                desc: "Tổ chức và theo dõi tiến độ học tập một cách hiệu quả",
                icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
              },
              {
                title: "Cộng tác team",
                desc: "Làm việc nhóm và chia sẻ kiến thức dễ dàng",
                icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
              },
              {
                title: "Theo dõi tiến độ",
                desc: "Xem chi tiết quá trình học tập của từng nhân viên",
                icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 sm:h-10 sm:w-10">
                  <svg
                    className="h-4 w-4 text-white sm:h-5 sm:w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={item.icon}
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm sm:text-base">
                    {item.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-white/70 sm:mt-1 sm:text-sm">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden rounded-xl bg-white/10 p-4 backdrop-blur sm:block sm:p-6">
            <p className="text-sm text-white/90 italic sm:text-base">
              &quot;Epath System Training đã giúp chúng tôi tiết kiệm 40% thời gian đào tạo nhân viên mới.&quot;
            </p>
            <div className="mt-3 flex items-center gap-3 sm:mt-4">
              <div className="h-8 w-8 rounded-full bg-white/20 sm:h-10 sm:w-10" />
              <div>
                <p className="text-sm font-medium text-white sm:text-base">Nguyễn Văn A</p>
                <p className="text-xs text-white/70 sm:text-sm">HR Manager</p>
              </div>
            </div>
          </div>
        </div>

        <p className="hidden text-xs text-white/50 sm:block sm:text-sm">
          © 2026 Epath System. All rights reserved.
        </p>
      </div>

      {/* Right Side - Form */}
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/10 p-6 sm:p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
