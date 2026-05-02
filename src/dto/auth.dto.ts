export interface SignUpDTO {
  fullName: string;
  email: string;
  password: string;
  role?: "User" | "Node" | "Admin";
  wallet?: string; // 👈 add
}

export interface LoginDTO {
    email: string;
    password: string;
}
