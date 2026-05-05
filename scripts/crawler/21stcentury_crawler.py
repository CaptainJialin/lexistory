"""
21世纪英语报爬虫
这是一个面向中国学生的英语学习网站，文章难度适合高中水平
"""
import requests
from bs4 import BeautifulSoup
from base import BaseCrawler, Article


class CenturyCrawler(BaseCrawler):
    """21世纪英语报爬虫"""

    def __init__(self):
        super().__init__(name="21stcentury", delay=1.5)
        self.base_url = "https://www.21stcentury.com.cn"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

    def fetch_list(self, pages: int = 3) -> list:
        """获取文章列表"""
        items = []
        # 高中英语板块
        for page in range(1, pages + 1):
            url = f"https://paper.i21st.cn/list1_1.html"  # 首页文章列表
            try:
                resp = requests.get(url, headers=self.headers, timeout=15)
                resp.encoding = 'utf-8'
                soup = BeautifulSoup(resp.text, 'html.parser')
                for a in soup.find_all('a', href=True):
                    href = a['href']
                    if 'article' in href or 'story' in href:
                        title = a.get_text(strip=True)
                        if title and len(title) > 5:
                            full_url = href if href.startswith('http') else self.base_url + href
                            items.append({'url': full_url, 'title': title})
            except Exception as e:
                print(f"  List page error: {e}")
        # 去重
        seen = set()
        unique = []
        for item in items:
            if item['url'] not in seen:
                seen.add(item['url'])
                unique.append(item)
        return unique[:20]

    def fetch_article(self, url: str) -> Article:
        """获取单篇文章"""
        resp = requests.get(url, headers=self.headers, timeout=15)
        resp.encoding = 'utf-8'
        soup = BeautifulSoup(resp.text, 'html.parser')

        title = soup.find('h1') or soup.find('h2')
        title_text = title.get_text(strip=True) if title else "Untitled"

        paragraphs = soup.find_all('p')
        content = '\n\n'.join(p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 15)

        return Article(
            id="",
            title=self.clean_text(title_text),
            content=self.clean_text(content),
            source="21stcentury",
            source_url=url,
            tags=["21stcentury", "senior-high"]
        )


if __name__ == "__main__":
    crawler = CenturyCrawler()
    crawler.run(pages=2)
