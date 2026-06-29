export interface Photo {
  id: string;
  sender: string;
  avatar: string;
  caption: string;
  url: string;
  createdAt: string;
  isTrending?: boolean;
}

// Danh sách dữ liệu ảnh giả lập ban đầu (được tuyển chọn ảnh đẹp giống Demo)
let photos: Photo[] = [
  {
    id: '1',
    sender: 'Thanh Hằng',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    caption: 'Một ngày đầy nắng tại bãi biển ☀️🌊',
    url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 phút trước
  },
  {
    id: '2',
    sender: 'Minh Thư & Lan Anh',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    caption: 'Đồ đôi đi chơi cuối tuần cùng cạ cứng! 👯‍♀️✨',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 giờ trước
  },
  {
    id: '3',
    sender: 'Khánh Vy',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    caption: 'Mũ rộng vành đi biển chuẩn bị hè nè các cậu ơi 👒👒',
    url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 giờ trước
  },
  {
    id: '4',
    sender: 'Trung Dũng & Hoàng Nam',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    caption: 'Họp mặt nhóm 4 bàn đề tài app Locket đỉnh chóp!',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 giờ trước
  },
  {
    id: '5',
    sender: 'Hoàng Nam',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    caption: 'Một bức ảnh thật chill lúc hoàng hôn 🌅',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 ngày trước
  }
];

// Lưới ảnh 2x2 trong Profile cá nhân của người dùng hiện tại ("Locket")
let profilePhotos: Photo[] = [
  {
    id: 'p1',
    sender: 'Locket',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    caption: 'Đang leo núi đón bình minh 🏔️🚶‍♂️',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'p2',
    sender: 'Locket',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    caption: 'Sương mù dày đặc quá không thấy lối đi 🌫️',
    url: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=800',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'p3',
    sender: 'Locket',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    caption: 'Bình yên bên bờ cát lặng sóng 🌅',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'p4',
    sender: 'Locket',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    caption: 'Ngắm nhìn dãy núi phủ tuyết trắng xóa ❄️🏔️',
    url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800',
    createdAt: new Date().toISOString(),
  }
];

// Danh sách ảnh Trending (tab Thịnh hành)
let trendingPhotos: Photo[] = [
  {
    id: 't1',
    sender: 'Linh Chi',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    caption: 'Góc nghiêng thần thánh 💖',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
    createdAt: new Date().toISOString(),
    isTrending: true,
  },
  {
    id: 't2',
    sender: 'Hương Giang',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
    caption: 'OOTD mùa thu nhẹ nhàng 🍂🧥',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
    createdAt: new Date().toISOString(),
    isTrending: true,
  },
  {
    id: 't3',
    sender: 'Phương Anh',
    avatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=150',
    caption: 'Nắng gió nhẹ nhàng sớm mai ☀️',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800',
    createdAt: new Date().toISOString(),
    isTrending: true,
  },
  {
    id: 't4',
    sender: 'Mỹ Linh',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    caption: 'Black jacket style cực ngầu 😎🖤',
    url: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800',
    createdAt: new Date().toISOString(),
    isTrending: true,
  }
];

// Quản lý cơ chế reactive thủ công để cập nhật UI khi thêm ảnh mới
type Listener = () => void;
const listeners = new Set<Listener>();

export const mockStore = {
  getPhotos() {
    return photos;
  },

  getProfilePhotos() {
    return profilePhotos;
  },

  getTrendingPhotos() {
    return trendingPhotos;
  },

  addPhoto(url: string, caption: string) {
    const newPhoto: Photo = {
      id: Date.now().toString(),
      sender: 'Locket',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
      caption: caption,
      url: url,
      createdAt: new Date().toISOString(),
    };
    
    // Thêm vào feed chung và danh sách của cá nhân
    photos = [newPhoto, ...photos];
    profilePhotos = [newPhoto, ...profilePhotos];
    
    // Kích hoạt tất cả các hàm lắng nghe sự thay đổi trạng thái
    listeners.forEach(listener => listener());
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};
