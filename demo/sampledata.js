/*
 * Copyright 2010 - 2012 Ed Venaglia
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

// sample data, includes population from 2000 census
var sampleData = [
	{'id':0 ,'name':'Alabama'       ,'abbr':'AL','inducted':'Dec 14, 1819','population':4627851 ,'capital':'Montgomery'    ,'region':'Southeast'},
	{'id':1 ,'name':'Alaska'        ,'abbr':'AK','inducted':'Jan 3, 1959' ,'population':683478  ,'capital':'Juneau'        ,'region':'Pacific'  },
	{'id':2 ,'name':'Arizona'       ,'abbr':'AZ','inducted':'Feb 14, 1912','population':6338755 ,'capital':'Phoenix'       ,'region':'Southwest'},
	{'id':3 ,'name':'Arkansas'      ,'abbr':'AR','inducted':'Jun 15, 1836','population':2834797 ,'capital':'Little Rock'   ,'region':'Southeast'},
	{'id':4 ,'name':'California'    ,'abbr':'CA','inducted':'Sep 9, 1850' ,'population':36553215,'capital':'Sacramento'    ,'region':'West'     },
	{'id':5 ,'name':'Colorado'      ,'abbr':'CO','inducted':'Aug 1, 1876' ,'population':4861515 ,'capital':'Denver'        ,'region':'West'     },
	{'id':6 ,'name':'Connecticut'   ,'abbr':'CT','inducted':'Jan 9, 1788' ,'population':3502309 ,'capital':'Hartford'      ,'region':'Northeast'},
	{'id':7 ,'name':'Delaware'      ,'abbr':'DE','inducted':'Dec 7, 1787' ,'population':864764  ,'capital':'Dover'         ,'region':'Northeast'},
	{'id':8 ,'name':'Florida'       ,'abbr':'FL','inducted':'Mar 3, 1845' ,'population':18251243,'capital':'Tallahassee'   ,'region':'Southeast'},
	{'id':9 ,'name':'Georgia'       ,'abbr':'GA','inducted':'Jan 2, 1788' ,'population':9544750 ,'capital':'Atlanta'       ,'region':'Southeast'},
	{'id':10,'name':'Hawaii'        ,'abbr':'HI','inducted':'Aug 21, 1959','population':1283388 ,'capital':'Honolulu'      ,'region':'Pacific'  },
	{'id':11,'name':'Idaho'         ,'abbr':'ID','inducted':'Jul 3, 1890' ,'population':1499402 ,'capital':'Boise'         ,'region':'West'     },
	{'id':12,'name':'Illinois'      ,'abbr':'IL','inducted':'Dec 3, 1818' ,'population':12852548,'capital':'Springfield'   ,'region':'Midwest'  },
	{'id':13,'name':'Indiana'       ,'abbr':'IN','inducted':'Dec 11, 1816','population':6345289 ,'capital':'Indianapolis'  ,'region':'Midwest'  },
	{'id':14,'name':'Iowa'          ,'abbr':'IA','inducted':'Dec 28, 1846','population':2988046 ,'capital':'Des Moines'    ,'region':'Midwest'  },
	{'id':15,'name':'Kansas'        ,'abbr':'KS','inducted':'Jan 29, 1861','population':2775997 ,'capital':'Topeka'        ,'region':'Midwest'  },
	{'id':16,'name':'Kentucky'      ,'abbr':'KY','inducted':'Jun 1, 1792' ,'population':4241474 ,'capital':'Frankfort'     ,'region':'Southeast'},
	{'id':17,'name':'Louisiana'     ,'abbr':'LA','inducted':'Apr 30, 1812','population':4293204 ,'capital':'Baton Rouge'   ,'region':'Southeast'},
	{'id':18,'name':'Maine'         ,'abbr':'ME','inducted':'Mar 15, 1820','population':1317207 ,'capital':'Augusta'       ,'region':'Northeast'},
	{'id':19,'name':'Maryland'      ,'abbr':'MD','inducted':'Apr 28, 1788','population':5618344 ,'capital':'Annapolis'     ,'region':'Northeast'},
	{'id':20,'name':'Massachusetts' ,'abbr':'MA','inducted':'Feb 6, 1788' ,'population':6449755 ,'capital':'Boston'        ,'region':'Northeast'},
	{'id':21,'name':'Michigan'      ,'abbr':'MI','inducted':'Jan 26, 1837','population':10071822,'capital':'Lansing'       ,'region':'Midwest'  },
	{'id':22,'name':'Minnesota'     ,'abbr':'MN','inducted':'May 11, 1858','population':5197621 ,'capital':'Saint Paul'    ,'region':'Midwest'  },
	{'id':23,'name':'Mississippi'   ,'abbr':'MS','inducted':'Dec 10, 1817','population':2918785 ,'capital':'Jackson'       ,'region':'Southeast'},
	{'id':24,'name':'Missouri'      ,'abbr':'MO','inducted':'Aug 10, 1821','population':5878415 ,'capital':'Jefferson City','region':'Southeast'},
	{'id':25,'name':'Montana'       ,'abbr':'MT','inducted':'Nov 8, 1889' ,'population':957861  ,'capital':'Helena'        ,'region':'West'     },
	{'id':26,'name':'Nebraska'      ,'abbr':'NE','inducted':'Mar 01, 1867','population':1774571 ,'capital':'Lincoln'       ,'region':'Midwest'  },
	{'id':27,'name':'Nevada'        ,'abbr':'NV','inducted':'Oct 31, 1864','population':2565382 ,'capital':'Carson City'   ,'region':'West'     },
	{'id':28,'name':'New Hampshire' ,'abbr':'NH','inducted':'Jun 21, 1788','population':1315828 ,'capital':'Concord'       ,'region':'Northeast'},
	{'id':29,'name':'New Jersey'    ,'abbr':'NJ','inducted':'Dec 18, 1787','population':8685920 ,'capital':'Trenton'       ,'region':'Northeast'},
	{'id':30,'name':'New Mexico'    ,'abbr':'NM','inducted':'Jan 6, 1912' ,'population':1969915 ,'capital':'Santa Fe'      ,'region':'Southwest'},
	{'id':31,'name':'New York'      ,'abbr':'NY','inducted':'Jul 26, 1788','population':19297729,'capital':'Albany'        ,'region':'Northeast'},
	{'id':32,'name':'North Carolina','abbr':'NC','inducted':'Nov 21, 1789','population':9061032 ,'capital':'Raleigh'       ,'region':'Southeast'},
	{'id':33,'name':'North Dakota'  ,'abbr':'ND','inducted':'Nov 2, 1889' ,'population':639715  ,'capital':'Bismarck'      ,'region':'Midwest'  },
	{'id':34,'name':'Ohio'          ,'abbr':'OH','inducted':'Mar 1, 1803' ,'population':11466917,'capital':'Columbus'      ,'region':'Midwest'  },
	{'id':35,'name':'Oklahoma'      ,'abbr':'OK','inducted':'Nov 16, 1907','population':3617316 ,'capital':'Oklahoma City' ,'region':'Southwest'},
	{'id':36,'name':'Oregon'        ,'abbr':'OR','inducted':'Feb 14, 1859','population':3747455 ,'capital':'Salem'         ,'region':'West'     },
	{'id':37,'name':'Pennsylvania'  ,'abbr':'PA','inducted':'Dec 12, 1787','population':12432792,'capital':'Harrisburg'    ,'region':'Northeast'},
	{'id':38,'name':'Rhode Island'  ,'abbr':'RI','inducted':'May 29, 1790','population':1057832 ,'capital':'Providence'    ,'region':'Northeast'},
	{'id':39,'name':'South Carolina','abbr':'SC','inducted':'May 23, 1788','population':4407709 ,'capital':'Columbia'      ,'region':'Southeast'},
	{'id':40,'name':'South Dakota'  ,'abbr':'SD','inducted':'Nov 2, 1889' ,'population':796214  ,'capital':'Pierre'        ,'region':'Midwest'  },
	{'id':41,'name':'Tennessee'     ,'abbr':'TN','inducted':'Jun 1, 1796' ,'population':6156719 ,'capital':'Nashville'     ,'region':'Southeast'},
	{'id':42,'name':'Texas'         ,'abbr':'TX','inducted':'Dec 29, 1845','population':23904380,'capital':'Austin'        ,'region':'Southwest'},
	{'id':43,'name':'Utah'          ,'abbr':'UT','inducted':'Jan 4, 1896' ,'population':2645330 ,'capital':'Salt Lake City','region':'West'     },
	{'id':44,'name':'Vermont'       ,'abbr':'VT','inducted':'Mar 4, 1791' ,'population':621254  ,'capital':'Montpelier'    ,'region':'Northeast'},
	{'id':45,'name':'Virginia'      ,'abbr':'VA','inducted':'Jun 25, 1788','population':7712091 ,'capital':'Richmond'      ,'region':'Southeast'},
	{'id':46,'name':'Washington'    ,'abbr':'WA','inducted':'Nov 11, 1889','population':6468424 ,'capital':'Olympia'       ,'region':'West'     },
	{'id':47,'name':'West Virginia' ,'abbr':'WV','inducted':'Jun 20, 1863','population':1812035 ,'capital':'Charleston'    ,'region':'Southeast'},
	{'id':48,'name':'Wisconsin'     ,'abbr':'WI','inducted':'May 29, 1848','population':5601640 ,'capital':'Madison'       ,'region':'Midwest'  },
	{'id':49,'name':'Wyoming'       ,'abbr':'WY','inducted':'Jul 10, 1890','population':522830  ,'capital':'Cheyenne'      ,'region':'West'     }
];
sampleData.forEach(function(s) { s.inducted = new Date(s.inducted); });
