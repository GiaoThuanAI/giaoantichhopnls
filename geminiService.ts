
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeLessonPlan(
  lessonContent: string,
  subject: string,
  grade: string,
  numSuggestions: number,
  frameworkContent?: string
): Promise<AnalysisResult> {
  const model = "gemini-3-pro-preview";
  
  const systemInstruction = `
Bạn là chuyên gia giáo dục Việt Nam cao cấp, am hiểu sâu sắc Chương trình GDPT 2018 và Khung Năng lực số cho học sinh.
Nhiệm vụ của bạn là nâng cấp giáo án gốc bằng cách tích hợp Năng lực số một cách khoa học và thực tiễn.

QUY TẮC TÍCH HỢP BẮT BUỘC:
1. TẠI MỤC "MỤC TIÊU": Thêm một mục nhỏ mới tên là "Năng lực số" (đặt sau mục Năng lực chung/Năng lực đặc thù). Nội dung mục này phải mô tả cụ thể học sinh sẽ phát triển năng lực số nào qua bài học. Toàn bộ phần thêm mới này phải bọc trong <span style="color: blue;">...</span>.

2. TẠI MỤC "TIẾN TRÌNH DẠY HỌC": 
   - Trong các hoạt động học tập, tìm các vị trí phù hợp để tích hợp công cụ số hoặc kỹ năng số.
   - Đặc biệt chú trọng bổ sung vào phần "Tổ chức thực hiện" (các bước hướng dẫn của GV) và phần "Sản phẩm" (kết quả học tập số của HS).
   - Mọi nội dung tích hợp thêm vào các tiểu mục này PHẢI được bọc trong thẻ <span style="color: blue;">...</span>.

3. SỐ LƯỢNG: Tích hợp khoảng ${numSuggestions} điểm nhấn quan trọng xuyên suốt bài dạy.

YÊU CẦU KỸ THUẬT:
- Giữ nguyên 100% cấu trúc và ngôn ngữ chuyên môn của giáo án gốc.
- Phù hợp với đặc thù môn ${subject} lớp ${grade}.
- Phản hồi bằng JSON duy nhất, không có ký tự điều khiển lạ. 'fullIntegratedContent' phải là văn bản giáo án hoàn chỉnh đã qua xử lý.
`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [
        {
          parts: [
            { text: `Yêu cầu: Tích hợp năng lực số vào giáo án môn ${subject} lớp ${grade}.` },
            { text: frameworkContent ? `Khung năng lực số tham chiếu: ${frameworkContent}` : "Sử dụng tiêu chuẩn năng lực số phổ thông Việt Nam." },
            { text: `NỘI DUNG GIÁO ÁN GỐC CẦN XỬ LÝ:\n${lessonContent}` }
          ]
        }
      ],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 4000 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            digitalCompetencies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  insertionPoint: { type: Type.STRING },
                  evaluationSigns: { type: Type.STRING },
                  originalTextProposal: { type: Type.STRING },
                },
                required: ["name", "description", "insertionPoint", "evaluationSigns", "originalTextProposal"]
              }
            },
            overallSummary: { type: Type.STRING },
            fullIntegratedContent: { type: Type.STRING }
          },
          required: ["digitalCompetencies", "overallSummary", "fullIntegratedContent"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI không trả về dữ liệu.");
    
    const cleanJson = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
