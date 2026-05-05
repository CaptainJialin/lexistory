"""
China Daily 教育板块爬虫
高考英语阅读文章很多改编自 China Daily，这里抓取教育相关文章
"""
import requests
from bs4 import BeautifulSoup
from base import BaseCrawler, Article


class ChinaDailyCrawler(BaseCrawler):
    """China Daily 教育/文化板块爬虫"""

    def __init__(self):
        super().__init__(name="chinadaily", delay=2.0)
        self.base_url = "https://www.chinadaily.com.cn"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

    def fetch_list(self, pages: int = 3) -> list:
        """获取文章列表"""
        items = []
        # 抓取教育板块
        for page in range(1, pages + 1):
            url = f"{self.base_url}/china/education/page_{page}.html"
            try:
                resp = requests.get(url, headers=self.headers, timeout=15)
                resp.encoding = 'utf-8'
                soup = BeautifulSoup(resp.text, 'html.parser')
                # 文章链接
                for a in soup.find_all('a', href=True):
                    href = a['href']
                    if '/a/' in href and 'chinadaily' in href:
                        title = a.get_text(strip=True)
                        if title and len(title) > 10:
                            items.append({'url': href if href.startswith('http') else self.base_url + href, 'title': title})
                    elif href.startswith('/a/'):
                        title = a.get_text(strip=True)
                        if title and len(title) > 10:
                            items.append({'url': self.base_url + href, 'title': title})
            except Exception as e:
                print(f"  List page {page} error: {e}")
        # 去重
        seen = set()
        unique = []
        for item in items:
            if item['url'] not in seen:
                seen.add(item['url'])
                unique.append(item)
        return unique[:30]  # 限制数量

    def fetch_article(self, url: str) -> Article:
        """获取单篇文章"""
        resp = requests.get(url, headers=self.headers, timeout=15)
        resp.encoding = 'utf-8'
        soup = BeautifulSoup(resp.text, 'html.parser')

        title = soup.find('h1')
        title_text = title.get_text(strip=True) if title else "Untitled"

        # 尝试多种内容选择器
        content = ""
        for selector in ['#Content', '.article-content', '#Content', 'article', '.main-content']:
            elem = soup.select_one(selector)
            if elem:
                paragraphs = elem.find_all('p')
                content = '\n\n'.join(p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 20)
                if len(content) > 200:
                    break

        return Article(
            id="",
            title=self.clean_text(title_text),
            content=self.clean_text(content),
            source="chinadaily",
            source_url=url,
            tags=["chinadaily", "education"]
        )


if __name__ == "__main__":
    crawler = ChinaDailyCrawler()
    crawler.run(pages=2)
