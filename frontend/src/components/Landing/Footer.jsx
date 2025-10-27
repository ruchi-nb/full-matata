"use client";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#111427] text-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="text-center text-sm sm:text-base">
            © {year} <span className="font-semibold">Neuralbits</span>. All rights reserved.
          </div>
        </div>
    </footer>
  );
};

export default Footer;
