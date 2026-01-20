
import React, { useState, useRef, useEffect } from 'react';
import { analyzeLessonPlan } from './geminiService';
import { AnalysisResult } from './types';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import saveAs from 'file-saver';

declare const mammoth: any;
declare const window: any;

const SUBJECTS = [
  "Tiếng Việt / Ngữ văn",
  "Toán",
  "Tiếng Anh / Ngoại ngữ",
  "Tự nhiên và Xã hội",
  "Lịch sử và Địa lí",
  "Khoa học tự nhiên",
  "Khoa học",
  "Vật lí",
  "Hóa học",
  "Sinh học",
  "Lịch sử",
  "Địa lí",
  "Giáo dục kinh tế và pháp luật",
  "Tin học",
  "Công nghệ",
  "Giáo dục thể chất",
  "Âm nhạc",
  "Mĩ thuật",
  "Hoạt động trải nghiệm, hướng nghiệp",
  "Nội dung giáo dục địa phương",
  "Giáo dục quốc phòng và an ninh",
  "Đạo đức / Giáo dục công dân"
];

const App: React.FC = () => {
  const [lessonContent, setLessonContent] = useState('');
  const [frameworkContent, setFrameworkContent] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [numSuggestions, setNumSuggestions] = useState(3);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'integrated' | 'details'>('integrated');
  const [showGuide, setShowGuide] = useState(false);

  const lessonFileRef = useRef<HTMLInputElement>(null);
  const frameworkFileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'lesson' | 'framework') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer });
        if (target === 'lesson') setLessonContent(res.value);
        else setFrameworkContent(res.value);
      } else {
        const text = await file.text();
        if (target === 'lesson') setLessonContent(text);
        else setFrameworkContent(text);
      }
    } catch (err) {
      setError(`Lỗi khi đọc file: ${file.name}. Vui lòng kiểm tra định dạng file.`);
    }
  };

  const handleOpenApiKeyDialog = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
    } else {
      alert("Tính năng chọn API Key chỉ khả dụng trong môi trường AI Studio.");
    }
  };

  const handleAnalyze = async () => {
    if (!lessonContent || !subject || !grade) {
      setError('Vui lòng cung cấp đầy đủ: Môn học, Khối lớp và Nội dung giáo án.');
      return;
    }
    
    setLoading(true);
    setResult(null);
    setError(null);
    setLoadingStep('Đang phân tích Mục tiêu & Tiến trình dạy học...');

    try {
      const data = await analyzeLessonPlan(lessonContent, subject, grade, numSuggestions, frameworkContent);
      setResult(data);
    } catch (err: any) {
      console.error(err);
      let errorMsg = 'Đã xảy ra lỗi trong quá trình phân tích.';
      if (err.message?.includes('JSON')) {
        errorMsg = 'Lỗi định dạng dữ liệu (Giáo án quá dài hoặc phức tạp). Vui lòng thử lại với số lượng tích hợp ít hơn hoặc kiểm tra API Key.';
      } else if (err.message?.includes('404') || err.message?.includes('not found')) {
        errorMsg = 'Không tìm thấy API Key hoặc Project. Vui lòng nhấn "Cấu hình API Key" để thiết lập.';
      } else if (err.message?.includes('API_KEY')) {
        errorMsg = 'Lỗi kết nối API. Vui lòng kiểm tra lại cấu hình.';
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const parseHtmlToTextRuns = (html: string, highlightColor: string = "0000FF") => {
    const parts = html.split(/(<span[^>]*>.*?<\/span>)/g);
    return parts.map(part => {
      if (part.startsWith('<span')) {
        const text = part.replace(/<[^>]*>/g, '');
        return new TextRun({ text, color: highlightColor, bold: true });
      }
      return new TextRun(part.replace(/<[^>]*>/g, ''));
    });
  };

  const handleDownloadWord = async () => {
    if (!result) return;

    const lines = result.fullIntegratedContent.split('\n');
    const docParagraphs = lines.map(line => {
      return new Paragraph({
        children: parseHtmlToTextRuns(line, "0000FF"),
        spacing: { after: 120 }
      });
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "KẾ HOẠCH BÀI DẠY (TÍCH HỢP NĂNG LỰC SỐ)",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Môn học: ${subject}`, bold: true }),
              new TextRun({ text: ` | Khối lớp: ${grade}`, bold: true, break: 1 }),
              new TextRun({ text: "Ghi chú: Nội dung màu xanh dương là phần đã tích hợp năng lực số (Mục tiêu & Tiến trình).", italics: true, color: "0000FF", break: 1 }),
            ],
            spacing: { after: 400 }
          }),
          ...docParagraphs,
          new Paragraph({
            text: "--------------------------------------------------",
            alignment: AlignmentType.CENTER,
            spacing: { before: 500 },
          }),
          new Paragraph({
            text: "Hỗ trợ bởi: Giáo Thuận AI - Zalo: 0908517762",
            alignment: AlignmentType.CENTER,
          })
        ],
      }],
    });

    try {
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `GiaoAn_TichHopSo_${subject.replace(/\//g, '-')}_${grade}.docx`);
    } catch (err) {
      alert('Lỗi khi tạo file Word. Vui lòng thử lại.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-10 text-center">
        <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl mb-4 shadow-xl">
          <i className="fas fa-brain text-white text-4xl"></i>
        </div>
        <h1 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight uppercase">
          Chuyên gia soạn giảng <br className="md:hidden" /> <span className="text-indigo-600">tích hợp năng lực số</span>
        </h1>
        <div className="flex items-center justify-center space-x-4 mt-4">
          <button 
            onClick={() => setShowGuide(!showGuide)}
            className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center bg-indigo-50 px-4 py-1.5 rounded-full transition-all"
          >
            <i className={`fas ${showGuide ? 'fa-times-circle' : 'fa-info-circle'} mr-2`}></i>
            {showGuide ? 'Đóng hướng dẫn' : 'Hướng dẫn sử dụng'}
          </button>
        </div>
      </header>

      {/* Guide Section */}
      {showGuide && (
        <section className="mb-10 animate-fadeIn">
          <div className="bg-white p-6 md:p-8 rounded-3xl border-2 border-indigo-100 shadow-sm relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-50 rounded-full opacity-50"></div>
            <h2 className="text-xl font-bold text-indigo-900 mb-6 flex items-center relative z-10">
              <i className="fas fa-star mr-3"></i> Tính năng tích hợp thông minh
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><i className="fas fa-bullseye"></i></div>
                  <div>
                    <h4 className="font-bold text-slate-800">Tích hợp vào Mục tiêu</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">AI tự động bổ sung tiểu mục <strong>"Năng lực số"</strong> ngay sau phần Mục tiêu bài học để làm rõ định hướng phát triển kỹ năng số.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><i className="fas fa-tasks"></i></div>
                  <div>
                    <h4 className="font-bold text-slate-800">Tích hợp vào Tiến trình</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">Nâng cấp các hoạt động trong phần <strong>"Tổ chức thực hiện"</strong> và bổ sung kết quả tại phần <strong>"Sản phẩm"</strong>.</p>
                  </div>
                </div>
              </div>
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                <h4 className="font-bold text-indigo-800 text-sm mb-2 flex items-center"><i className="fas fa-lightbulb mr-2"></i> Lưu ý:</h4>
                <ul className="text-[11px] text-indigo-600 space-y-2 list-disc list-inside">
                  <li>Nội dung tích hợp sẽ hiển thị màu <strong>Xanh dương</strong>.</li>
                  <li>Sử dụng file .docx để giữ định dạng tốt nhất.</li>
                  <li>Nhấn nút <strong>Cấu hình API Key</strong> nếu hệ thống báo lỗi kết nối.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Configuration Panel */}
        <section className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
              <i className="fas fa-edit mr-2 text-indigo-500"></i> Cấu hình soạn giảng
            </h2>
            
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Môn học</label>
                  <select 
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  >
                    <option value="">Chọn môn học...</option>
                    {SUBJECTS.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Khối lớp</label>
                  <select 
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                  >
                    <option value="">Chọn khối...</option>
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={`Lớp ${i + 1}`}>Lớp {i + 1}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Số lượng tích hợp mới</label>
                <select 
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={numSuggestions}
                  onChange={(e) => setNumSuggestions(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <option key={n} value={n}>{n} hoạt động tích hợp</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Tài liệu đầu vào</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => lessonFileRef.current?.click()}
                    className="py-3 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all text-xs font-bold flex flex-col items-center justify-center space-y-1"
                  >
                    <i className="fas fa-file-word text-xl mb-1 text-blue-500"></i>
                    <span>{lessonContent ? 'Thay đổi giáo án' : 'Tải Giáo án Word'}</span>
                  </button>
                  <button 
                    onClick={() => frameworkFileRef.current?.click()}
                    className="py-3 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all text-xs font-bold flex flex-col items-center justify-center space-y-1"
                  >
                    <i className="fas fa-shield-alt text-xl mb-1 text-indigo-500"></i>
                    <span>{frameworkContent ? 'Thay đổi khung' : 'Khung NL số khác'}</span>
                  </button>
                </div>
                <input type="file" ref={lessonFileRef} className="hidden" accept=".docx,.txt" onChange={(e) => handleFileUpload(e, 'lesson')} />
                <input type="file" ref={frameworkFileRef} className="hidden" accept=".docx,.txt" onChange={(e) => handleFileUpload(e, 'framework')} />
              </div>

              <div>
                <textarea 
                  className="w-full h-40 px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-sm bg-slate-50 resize-none font-mono"
                  placeholder="Hoặc dán nội dung giáo án tại đây..."
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                ></textarea>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-start space-x-2 animate-pulse">
                  <i className="fas fa-exclamation-circle mt-0.5"></i>
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-3">
                <button 
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-xl transition-all shadow-lg flex flex-col items-center justify-center transform active:scale-[0.98]"
                >
                  {loading ? (
                    <div className="flex flex-col items-center">
                      <i className="fas fa-spinner fa-spin mb-1 text-lg"></i>
                      <span className="text-xs font-medium uppercase tracking-widest">{loadingStep}</span>
                    </div>
                  ) : (
                    <>
                      <i className="fas fa-wand-magic-sparkles mb-1 text-lg"></i>
                      <span className="uppercase tracking-wide font-black">SOẠN GIÁO ÁN TÍCH HỢP</span>
                    </>
                  )}
                </button>

                <button 
                  onClick={handleOpenApiKeyDialog}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center space-x-2 border border-slate-200"
                >
                  <i className="fas fa-key"></i>
                  <span>CẤU HÌNH API KEY (DÀNH CHO TÀI KHOẢN TRẢ PHÍ)</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Results Panel */}
        <section className="lg:col-span-7">
          {result ? (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-100">
                      <i className="fas fa-check text-xl"></i>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">Đã tích hợp xong!</h3>
                      <p className="text-xs text-slate-500 font-medium uppercase">{subject} - {grade}</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleDownloadWord}
                    className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all hover:-translate-y-0.5"
                  >
                    <i className="fas fa-download"></i>
                    <span>Tải Giáo án (.docx)</span>
                  </button>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                  <button 
                    onClick={() => setViewMode('integrated')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${viewMode === 'integrated' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                  >
                    Giáo án tích hợp mới
                  </button>
                  <button 
                    onClick={() => setViewMode('details')}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${viewMode === 'details' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                  >
                    Chi tiết các điểm mới
                  </button>
                </div>

                {viewMode === 'integrated' ? (
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-inner max-h-[600px] overflow-y-auto font-serif text-slate-800 leading-relaxed text-sm whitespace-pre-wrap">
                    <div dangerouslySetInnerHTML={{ __html: result.fullIntegratedContent.replace(/\n/g, '<br/>') }} />
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-900 text-sm italic">
                       <strong><i className="fas fa-lightbulb mr-2"></i> Nhận xét từ chuyên gia:</strong> {result.overallSummary}
                    </div>
                    {result.digitalCompetencies.map((comp, idx) => (
                      <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all group">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-[10px] bg-slate-800 text-white px-2.5 py-1 rounded-md uppercase font-black tracking-widest">Phần tích hợp {idx + 1}</span>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{comp.insertionPoint}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 mb-2">{comp.name}</h4>
                        <p className="text-slate-600 text-xs leading-relaxed mb-4">{comp.description}</p>
                        <div className="p-3 bg-slate-50 rounded-lg text-[10px] text-slate-500 border-l-4 border-indigo-400">
                          <strong>Dấu hiệu đánh giá:</strong> {comp.evaluationSigns}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-8 flex items-center justify-center space-x-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="flex items-center"><span className="w-3 h-3 bg-blue-600 rounded-full mr-2 shadow-sm"></span> Bổ sung mới (Xanh)</div>
                  <div className="flex items-center"><span className="w-3 h-3 bg-slate-300 rounded-full mr-2 shadow-sm"></span> Nội dung cũ</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center">
              <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-200">
                <i className="fas fa-magic text-5xl"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-400 mb-2">Đang chờ tích hợp giáo án</h3>
              <p className="max-w-xs mx-auto text-slate-400 text-sm leading-relaxed">
                Tải lên kế hoạch bài dạy của bạn, AI sẽ tự động đề xuất và lồng ghép năng lực số vào Mục tiêu, Sản phẩm và Tổ chức thực hiện.
              </p>
            </div>
          )}
        </section>
      </div>

      <footer className="mt-20 py-10 border-t border-slate-200 bg-white -mx-4 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div className="space-y-4">
            <h4 className="font-black text-slate-800 uppercase tracking-tighter text-lg">Giáo Thuận AI</h4>
            <p className="text-slate-500 text-sm">Chuyên gia ứng dụng trí tuệ nhân tạo vào giáo dục và đào tạo. Hỗ trợ chuyển đổi số sư phạm toàn diện.</p>
          </div>
          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-widest">Liên hệ hỗ trợ</h4>
            <div className="flex flex-col space-y-2">
              <a href="tel:0908517762" className="text-indigo-600 font-bold hover:underline flex items-center justify-center md:justify-start">
                <i className="fas fa-phone-alt mr-2"></i> 0908.517.762 (Zalo)
              </a>
              <p className="text-slate-500 text-xs">Mọi thắc mắc về App vui lòng liên hệ trực tiếp qua Zalo.</p>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-widest">Cộng đồng</h4>
            <a 
              href="https://zalo.me/g/vxteft076" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-2.5 bg-green-500 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-green-600 transition-all"
            >
              <i className="fas fa-users mr-2"></i> NHÓM HỌC AI MIỄN PHÍ
            </a>
            <p className="text-slate-400 text-[10px]">Học ứng dụng AI vào giảng dạy cùng hàng ngàn giáo viên khác.</p>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-slate-100 text-center">
          <p className="text-slate-400 text-[10px] font-medium uppercase tracking-[0.2em]">
            © 2024 CHUYÊN GIA SOẠN GIẢNG TÍCH HỢP NĂNG LỰC SỐ - PHÁT TRIỂN BỞI GIÁO THUẬN AI
          </p>
        </div>
      </footer>

      <style>{`
        .animate-fadeIn {
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        ::-webkit-scrollbar {
          width: 5px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        select {
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default App;
