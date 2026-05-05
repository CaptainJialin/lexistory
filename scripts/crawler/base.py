"""
通用爬虫基类，用于抓取英语阅读文章
"""
import json
import os
import re
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import List, Optional
import hashlib


@dataclass
class Article:
    """文章数据结构"""
    id: str
    title: str
    content: str
    source: str  # 来源网站
    source_url: str
    year: Optional[int] = None  # 高考年份
    exam_type: Optional[str] = None  # 全国甲卷/四川卷/新高考I卷等
    article_type: Optional[str] = None  # 阅读理解A/B/C/D篇，完形填空等
    tags: List[str] = None
    fetched_at: str = ""

    def __post_init__(self):
        if not self.fetched_at:
            self.fetched_at = datetime.now().isoformat()
        if self.tags is None:
            self.tags = []
        if not self.id:
            # 根据内容和标题生成唯一ID
            text = f"{self.title}:{self.content[:100]}"
            self.id = hashlib.md5(text.encode()).hexdigest()[:12]


class BaseCrawler(ABC):
    """爬虫基类"""

    def __init__(self, name: str, delay: float = 1.0):
        self.name = name
        self.delay = delay  # 请求间隔（秒）
        self.articles: List[Article] = []

    @abstractmethod
    def fetch_list(self, **kwargs) -> List[dict]:
        """获取文章列表（返回URL和标题）"""
        pass

    @abstractmethod
    def fetch_article(self, url: str) -> Optional[Article]:
        """获取单篇文章详情"""
        pass

    def clean_text(self, text: str) -> str:
        """清理文本：移除多余空白、特殊字符"""
        if not text:
            return ""
        # 替换多种空白为单个空格
        text = re.sub(r'\s+', ' ', text)
        # 移除不可见字符
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)
        return text.strip()

    def is_english_text(self, text: str, threshold: float = 0.6) -> bool:
        """判断文本是否为英文（英文单词比例超过阈值）"""
        if not text:
            return False
        words = re.findall(r'[a-zA-Z]+', text)
        total_chars = len(text.replace(' ', ''))
        if total_chars == 0:
            return False
        english_chars = sum(len(w) for w in words)
        return english_chars / total_chars >= threshold

    def save(self, output_dir: str = "../../data/gaokao-articles"):
        """保存抓取的文章到JSON文件"""
        os.makedirs(output_dir, exist_ok=True)
        filename = f"{self.name}_{datetime.now().strftime('%Y%m%d')}.json"
        filepath = os.path.join(output_dir, filename)
        data = [asdict(a) for a in self.articles]
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Saved {len(self.articles)} articles to {filepath}")

    def run(self, **kwargs):
        """运行爬虫"""
        print(f"[{self.name}] Starting crawl...")
        items = self.fetch_list(**kwargs)
        print(f"[{self.name}] Found {len(items)} articles")
        for i, item in enumerate(items):
            try:
                article = self.fetch_article(item['url'])
                if article and self.is_english_text(article.content):
                    self.articles.append(article)
                    print(f"  [{i+1}/{len(items)}] OK: {article.title[:50]}")
                else:
                    print(f"  [{i+1}/{len(items)}] SKIP: Not English or empty")
                time.sleep(self.delay)
            except Exception as e:
                print(f"  [{i+1}/{len(items)}] ERROR: {e}")
        self.save()
