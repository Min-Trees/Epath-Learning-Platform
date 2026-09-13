// scripts/test-api-me-programs.cjs
// Test trực tiếp API /api/me/programs để xem nó trả về gì

const http = require('http');

// Lấy token của Duyên Nguyễn bằng cách gọi Firebase Auth REST API
async function getIdToken(email, password) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );
  const data = await res.json();
  if (data.error) {
    throw new Error(JSON.stringify(data.error));
  }
  return data.idToken;
}

async function callApi(path, token) {
  const url = `http://localhost:3000${path}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': '', // Clear cookie cache
    },
  });
  return {
    status: res.status,
    data: await res.json().catch(() => null),
  };
}

async function main() {
  const email = process.argv[2] || 'duyen.nguyen@littlepeople.edu.vn';
  const password = process.argv[3];

  if (!password) {
    console.log('❌ Cần nhập password làm argument:');
    console.log('   node test-api-me-programs.cjs <email> <password>');
    console.log('\nHoặc set biến môi trường:');
    console.log('   $env:TEST_USER_PASSWORD="..." ; node test-api-me-programs.cjs');
    process.exit(1);
  }

  console.log(`\n🔐 Đang đăng nhập với: ${email}`);
  const token = await getIdToken(email, password);
  console.log('✅ Đăng nhập thành công, token:', token.substring(0, 30) + '...');

  console.log('\n📡 Gọi API /api/me/programs...');
  const start = Date.now();
  const result = await callApi('/api/me/programs', token);
  const elapsed = Date.now() - start;

  console.log(`\n⏱️  Thời gian phản hồi: ${elapsed}ms`);
  console.log(`📊 Status: ${result.status}`);

  if (result.data?.success) {
    const items = result.data.data?.items || [];
    const groups = result.data.data?.groups || [];
    
    console.log(`\n📚 Số chương trình: ${items.length}`);
    console.log(`📂 Số nhóm: ${groups.length}\n`);
    
    items.forEach((item, i) => {
      const p = item.program;
      if (p) {
        console.log(`   ${i + 1}. ${p.title}`);
        console.log(`      Status: ${item.status} | Lessons: ${item.progress?.totalLessons ?? 0}`);
      } else {
        console.log(`   ${i + 1}. ⚠️  Program ${item.programId} không tồn tại`);
      }
    });
  } else {
    console.log('\n❌ Response:', JSON.stringify(result.data, null, 2));
  }

  console.log('\n');
}

main().catch(e => {
  console.error('Lỗi:', e.message);
  process.exit(1);
});
