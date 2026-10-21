import React, { useState } from 'react';
import {
  HelpCircle,
  X,
  Shield,
  Lock,
  Key,
  CheckCircle2,
  AlertTriangle,
  FileKey,
  Server,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Eye,
  Info
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenVault?: () => void;
  onOpenCredentials?: () => void;
  onOpenPasswords?: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  onOpenVault,
  onOpenCredentials,
  onOpenPasswords
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'vault' | 'credentials' | 'passwords' | 'security'>('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[250] backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#1e1e22] border border-[#3e3e44] rounded-xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-[#3e3e44] bg-[#25252a]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Security & Password Guide (คู่มือความปลอดภัย)</h2>
              <p className="text-[11px] text-gray-400">เข้าใจการทำงานของ Vault, Credentials และ Password Manager แบบปลอดภัย 100%</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[#3e3e44] text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden min-h-[460px]">
          {/* Sidebar Tabs */}
          <div className="w-52 bg-[#232328] border-r border-[#3e3e44] p-2 flex flex-col gap-1 shrink-0">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-all text-left ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-300 hover:bg-[#2d2d34] hover:text-white'
              }`}
            >
              <Info className="w-4 h-4 shrink-0" />
              <span>ภาพรวม 3 ระบบ</span>
            </button>

            <button
              onClick={() => setActiveTab('vault')}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-all text-left ${
                activeTab === 'vault'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-300 hover:bg-[#2d2d34] hover:text-white'
              }`}
            >
              <Lock className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>1. Master Vault (ตู้เซฟ)</span>
            </button>

            <button
              onClick={() => setActiveTab('credentials')}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-all text-left ${
                activeTab === 'credentials'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-300 hover:bg-[#2d2d34] hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0 text-amber-400" />
              <span>2. Credentials (ชุดบัญชี)</span>
            </button>

            <button
              onClick={() => setActiveTab('passwords')}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-all text-left ${
                activeTab === 'passwords'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-300 hover:bg-[#2d2d34] hover:text-white'
              }`}
            >
              <Key className="w-4 h-4 shrink-0 text-purple-400" />
              <span>3. Passwords (ดูรหัสผ่าน)</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-all text-left ${
                activeTab === 'security'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-gray-300 hover:bg-[#2d2d34] hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-sky-400" />
              <span>เคล็ดลับความปลอดภัย</span>
            </button>
          </div>

          {/* Content Pane */}
          <div className="flex-1 p-6 overflow-y-auto bg-[#1a1a1d] text-gray-200 text-xs leading-relaxed space-y-4 custom-scrollbar">
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-blue-950/60 to-purple-950/60 border border-blue-500/30 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                    เปรียบเทียบหน้าที่ของ 3 เมนูสำคัญ
                  </h3>
                  <p className="text-gray-300 text-[11px]">
                    เพื่อให้จัดการรหัสผ่านและกุญแจรีโมท (SSH Keys) ได้อย่างปลอดภัย โปรแกรมแบ่งหน้าที่การทำงานออกเป็น 3 เมนูดังนี้:
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="bg-[#24242a] border border-[#3e3e46] rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-3">
                        <Lock className="w-4 h-4" />
                      </div>
                      <h4 className="font-semibold text-white text-xs mb-1">1. Vault (ตู้เซฟ)</h4>
                      <p className="text-gray-400 text-[11px] leading-normal">
                        เป็น <b>แม่กุญแจดอกเดียว (Master Password)</b> ใช้เข้ารหัสข้อมูลทั้งหมดด้วยมาตรฐาน <b>AES-256</b> หากไม่ปลดล็อก คนอื่นจะไม่สามารถอ่านรหัสผ่านของคุณได้เลย
                      </p>
                    </div>
                    <button
                      onClick={() => { onClose(); onOpenVault?.(); }}
                      className="mt-3 w-full py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded text-[11px] font-medium border border-emerald-500/40 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>เปิด Vault</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="bg-[#24242a] border border-[#3e3e46] rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-3">
                        <Shield className="w-4 h-4" />
                      </div>
                      <h4 className="font-semibold text-white text-xs mb-1">2. Credentials</h4>
                      <p className="text-gray-400 text-[11px] leading-normal">
                        สร้าง <b>ชุดล็อกอินกลาง (Reusable Profile)</b> เช่น ชุดบัญชี "Production-Admin" ผูกกับเซิร์ฟเวอร์หลายสิบเครื่อง เมื่อเปลี่ยนรหัสผ่าน แก้ที่นี่ที่เดียว อัปเดตครบทุกเครื่อง
                      </p>
                    </div>
                    <button
                      onClick={() => { onClose(); onOpenCredentials?.(); }}
                      className="mt-3 w-full py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 rounded text-[11px] font-medium border border-amber-500/40 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>เปิด Credentials</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="bg-[#24242a] border border-[#3e3e46] rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center mb-3">
                        <Key className="w-4 h-4" />
                      </div>
                      <h4 className="font-semibold text-white text-xs mb-1">3. Passwords</h4>
                      <p className="text-gray-400 text-[11px] leading-normal">
                        หน้าต่างสำหรับ <b>ตรวจสอบภาพรวมรหัสผ่านทั้งหมด</b> ที่เคยบันทึกไว้ในแต่ละ Session สามารถกดเปิดตาดู คัดลอก หรือสั่งลบรหัสผ่านออกจากเซสชันได้ง่ายๆ
                      </p>
                    </div>
                    <button
                      onClick={() => { onClose(); onOpenPasswords?.(); }}
                      className="mt-3 w-full py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 rounded text-[11px] font-medium border border-purple-500/40 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>เปิด Passwords</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="bg-[#242428] border border-[#3a3a40] rounded-lg p-3 text-[11px] text-gray-300 flex items-start gap-2.5 mt-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">คำแนะนำการใช้งานให้ปลอดภัยสูงสุด:</span>
                    <p className="text-gray-400 mt-0.5">
                      เริ่มด้วยการกดปุ่ม <b>Vault</b> เพื่อตั้งรหัสผ่าน Master Password ก่อนเป็นอันดับแรก จากนั้นรหัสผ่านและ Private Key ทุกตัวที่คุณบันทึกในโปรแกรมจะถูกเข้ารหัสแบบ <b>AES-256</b> อัตโนมัติทันที
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: VAULT */}
            {activeTab === 'vault' && (
              <div className="space-y-4">
                <div className="border-l-4 border-emerald-500 bg-emerald-950/20 pl-3 py-1.5">
                  <h3 className="text-sm font-semibold text-emerald-300">1. Master Vault (การทำงานของตู้เซฟ)</h3>
                  <p className="text-gray-400 text-[11px]">เกราะป้องกันรหัสผ่านระดับสูงสุดด้วยการเข้ารหัส Military-grade AES-256</p>
                </div>

                <div className="space-y-2.5">
                  <h4 className="font-semibold text-white text-xs">วิธีเปิดใช้งาน Vault ครั้งแรก:</h4>
                  <ol className="list-decimal pl-5 space-y-1.5 text-gray-300">
                    <li>คลิกที่ไอคอน <b>Vault</b> (รูปแม่กุญแจ) บนแถบ Toolbar ด้านบน</li>
                    <li>ตั้งรหัสผ่าน <b>Master Password</b> ที่คุณจำได้แม่นยำ (ความยาวอย่างน้อย 8 ตัวอักษร มีตัวพิมพ์เล็ก พิมพ์ใหญ่ และตัวเลข)</li>
                    <li>ยืนยันรหัสผ่านเดิมอีกครั้ง แล้วคลิก <b>Set Master Password</b></li>
                  </ol>
                </div>

                <div className="bg-amber-950/30 border border-amber-600/40 rounded-lg p-3 text-[11px] text-amber-200 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-300">ข้อควรระวังสำคัญมาก:</span>
                    <p className="text-amber-200/80 mt-0.5">
                      โปรแกรมจะไม่บันทึก Master Password ลงในไฟล์หรือส่งออกอินเทอร์เน็ตเด็ดขาด! หากคุณลืม Master Password ข้อมูลรหัสผ่านที่ถูกเข้ารหัสไว้จะไม่สามารถกู้คืนได้ (ต้องตั้งเซสชันใหม่) ดังนั้นโปรดจดจำ Master Password ไว้ให้ดี
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-white text-xs">พฤติกรรมการทำงานเมื่อปิดและเปิดแอป:</h4>
                  <ul className="list-disc pl-5 space-y-1 text-gray-300 text-[11px]">
                    <li>เมื่อเปิดโปรแกรมใหม่ ตัว Vault จะอยู่ในสถานะ <b>Locked 🔒</b> เสมอ</li>
                    <li>เมื่อคุณดับเบิลคลิกเชื่อมต่อเซสชันหรือเปิดดูรหัสผ่าน โปรแกรมจะมีหน้าต่างถาม Master Password เพียงครั้งเดียวเพื่อปลดล็อกเซสชันการทำงาน</li>
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 3: CREDENTIALS */}
            {activeTab === 'credentials' && (
              <div className="space-y-4">
                <div className="border-l-4 border-amber-500 bg-amber-950/20 pl-3 py-1.5">
                  <h3 className="text-sm font-semibold text-amber-300">2. Credential Manager (ชุดบัญชีที่ใช้ซ้ำได้)</h3>
                  <p className="text-gray-400 text-[11px]">จัดการบัญชีล็อกอินแบบรวมศูนย์ สะดวกสำหรับองค์กรที่มีเซิร์ฟเวอร์หลายเครื่อง</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-white text-xs">ทำไมควรใช้ Credential Manager?</h4>
                  <p className="text-gray-300 text-[11px]">
                    หากคุณมีเซิร์ฟเวอร์ 20 เครื่องที่ใช้ User และ Password เดียวกัน (เช่น <code className="bg-[#292930] px-1.5 py-0.5 rounded text-amber-300">ubuntu</code> หรือ <code className="bg-[#292930] px-1.5 py-0.5 rounded text-amber-300">root</code>) แทนที่จะต้องพิมพ์รหัสผ่านซ้ำ 20 ครั้ง:
                  </p>
                  <div className="bg-[#232328] border border-[#3e3e44] rounded-lg p-3 text-[11px] text-gray-300 space-y-1">
                    <p>✅ สร้าง Credential กลาง 1 รายการ เช่น ตั้งชื่อว่า <b>"Cloud-Servers"</b></p>
                    <p>✅ เลือกผูก Credential นี้ให้กับเซสชันทั้ง 20 เครื่อง</p>
                    <p>✅ เมื่อถึงรอบนโยบายเปลี่ยนรหัสผ่าน (Change Password) ให้มาแก้ที่ <b>Credentials</b> ที่เดียว เซสชันทั้ง 20 เครื่องจะอัปเดตตามทันที!</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-white text-xs">วิธีสร้างและนำไปผูกกับ Session:</h4>
                  <ol className="list-decimal pl-5 space-y-1.5 text-gray-300 text-[11px]">
                    <li>คลิกปุ่ม <b>Credentials</b> บน Toolbar แล้วคลิก <b>+ New Credential</b></li>
                    <li>กรอกชื่อเรียก, Username, และ Password หรือเลือกแนบไฟล์ <b>SSH Private Key (.pem, .id_rsa)</b></li>
                    <li>กด <b>Save Credential</b></li>
                    <li>เมื่อไปที่หน้าต่างสร้าง/แก้ไขเซสชัน (Session Settings) ในช่อง Credential ให้เลือกชื่อชุดบัญชีที่คุณสร้างไว้ได้เลย</li>
                  </ol>
                </div>
              </div>
            )}

            {/* TAB 4: PASSWORDS */}
            {activeTab === 'passwords' && (
              <div className="space-y-4">
                <div className="border-l-4 border-purple-500 bg-purple-950/20 pl-3 py-1.5">
                  <h3 className="text-sm font-semibold text-purple-300">3. Passwords Manager (สมุดรหัสผ่านประจำเซสชัน)</h3>
                  <p className="text-gray-400 text-[11px]">ตรวจสอบและลบรหัสผ่านที่บันทึกไว้ในรายชื่อ Session</p>
                </div>

                <div className="space-y-2 text-gray-300 text-[11px]">
                  <p>
                    เมนู <b>Passwords</b> บน Toolbar จะแสดงรายชื่อเซสชันทั้งหมดที่คุณเคยติ๊กถูกเลือก <i>"Save Password"</i> เอาไว้:
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-gray-300">
                    <li><b>ดูรหัสผ่าน:</b> คลิกที่ไอคอนรูป <Eye className="w-3.5 h-3.5 inline text-sky-400" /> เพื่อเปิดดูรหัสผ่านตัวจริง</li>
                    <li><b>คัดลอกรหัสผ่าน:</b> คลิกปุ่มคัดลอกเพื่อนำไปใช้ล็อกอินผ่านหน้าเว็บหรือช่องทางอื่นได้ทันที</li>
                    <li><b>ลบรหัสผ่าน:</b> หากไม่ต้องการให้จำรหัสผ่านของเครื่องนั้นอีกต่อไป คลิกไอคอนรูปถังขยะ รหัสผ่านจะถูกลบทันทีโดยที่เซสชันยังคงอยู่</li>
                    <li><b>สถานะ [Locked]:</b> หากยังไม่ได้ปลดล็อก Vault รหัสผ่านจะแสดงผลเป็น 🔒 <i>[Locked]</i> ป้องกันคนแอบมองหน้าจอ</li>
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 5: SECURITY TIPS */}
            {activeTab === 'security' && (
              <div className="space-y-4">
                <div className="border-l-4 border-sky-500 bg-sky-950/20 pl-3 py-1.5">
                  <h3 className="text-sm font-semibold text-sky-300">ความปลอดภัยและการสำรองข้อมูล (Best Practices)</h3>
                  <p className="text-gray-400 text-[11px]">แนวทางปฏิบัติเพื่อให้ข้อมูลการรีโมทของท่านปลอดภัยสูงสุด</p>
                </div>

                <div className="space-y-3">
                  <div className="bg-[#24242a] border border-[#3e3e46] rounded-lg p-3">
                    <h4 className="font-semibold text-white text-xs mb-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      1. ใช้ SSH Key Pairs แทน Password ธรรมดา
                    </h4>
                    <p className="text-gray-400 text-[11px]">
                      การใช้กุญแจคู่รหัส (Private Key) ปลอดภัยกว่า Password ธรรมดาหลายเท่า เพราะไม่สามารถเดาสุ่มได้ (Brute-force resistant) ท่านสามารถนำไฟล์ <code className="text-sky-300">.pem</code> หรือ <code className="text-sky-300">.id_rsa</code> มาบันทึกลงใน Credential Manager ได้โดยตรง
                    </p>
                  </div>

                  <div className="bg-[#24242a] border border-[#3e3e46] rounded-lg p-3">
                    <h4 className="font-semibold text-white text-xs mb-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      2. ล็อกหน้าจอหรือปิดโปรแกรมเมื่อลุกจากโต๊ะ
                    </h4>
                    <p className="text-gray-400 text-[11px]">
                      เมื่อปิดโปรแกรม KirinTerminal ตัว Master Vault จะล็อกตัวเองทันที แม้คนอื่นจะมาเปิดโปรแกรมบนเครื่องคุณ ก็จะไม่สามารถกดดูรหัสผ่านได้หากไม่มี Master Password
                    </p>
                  </div>

                  <div className="bg-[#24242a] border border-[#3e3e46] rounded-lg p-3">
                    <h4 className="font-semibold text-white text-xs mb-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      3. ข้อมูลถูกเก็บไว้ที่ไหน?
                    </h4>
                    <p className="text-gray-400 text-[11px]">
                      ข้อมูลทั้งหมดถูกเก็บไว้ในเครื่องของผู้ใช้คนเดียวที่โฟลเดอร์ <code className="text-amber-300">%APPDATA%\mobaxterm-clone\config.json</code> ไม่มีการส่งข้อมูลใดๆ ไปยัง Cloud ภายนอก ทำให้มั่นใจได้ในความเป็นส่วนตัว 100%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#3e3e44] bg-[#25252a] flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            KirinTerminal Security Standard • AES-256 Encryption
          </span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-[#007acc] hover:bg-[#0069b0] text-white rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-sm"
          >
            เข้าใจแล้ว (ปิดหน้าต่าง)
          </button>
        </div>
      </div>
    </div>
  );
};
