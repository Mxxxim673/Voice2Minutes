import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

export const exportToWord = async (content: string, filename: string = 'document') => {
  try {
    // 解析内容，按行分割并识别结构
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const paragraphs: Paragraph[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // 识别标题（以数字和点开头，或包含“主题”、“日期”等关键词）
      const isMainHeading = /^\d+\.\s/.test(trimmedLine) || 
                           trimmedLine.includes('主题') || 
                           trimmedLine.includes('日期') || 
                           trimmedLine.includes('参会者') ||
                           trimmedLine.includes('议题') ||
                           trimmedLine.includes('决定事宜') ||
                           trimmedLine.includes('To-Do') ||
                           trimmedLine.includes('会议主題') ||
                           trimmedLine.includes('参加者') ||
                           trimmedLine.includes('議題') ||
                           trimmedLine.includes('決定事項') ||
                           trimmedLine.includes('Meeting Topic') ||
                           trimmedLine.includes('Participants') ||
                           trimmedLine.includes('Agenda') ||
                           trimmedLine.includes('Decisions');
      
      // 识别子项（以“-”开头）
      const isSubItem = trimmedLine.startsWith('- ');
      
      if (isMainHeading) {
        // 主标题样式
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine,
                bold: true,
                size: 28, // 14pt
                color: '2563eb', // 蓝色
              })
            ],
            spacing: {
              before: index === 0 ? 0 : 240, // 标题前间距
              after: 120, // 标题后间距
              line: 360,
            }
          })
        );
      } else if (isSubItem) {
        // 子项样式
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine,
                size: 24, // 12pt
              })
            ],
            spacing: {
              before: 60,
              after: 60,
              line: 300,
            },
            indent: {
              left: 360, // 缩进
            }
          })
        );
      } else if (trimmedLine !== '') {
        // 普通段落
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine,
                size: 24, // 12pt
              })
            ],
            spacing: {
              before: 120,
              after: 120,
              line: 360,
            }
          })
        );
      }
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${filename}.docx`);
  } catch (error) {
    console.error('Error exporting to Word:', error);
    throw new Error('Failed to export document');
  }
};


export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (fallbackError) {
      console.error('Fallback copy failed:', fallbackError);
      return false;
    }
  }
};